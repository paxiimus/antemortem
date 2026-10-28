# Ante Mortem — deployment driver. Run from repo root.
# Build + push the image here; the box pulls it via ./deploy.sh. Server-side logic lives in
# scripts/deploy.sh; this file only dispatches. Config comes from .deploy.env (gitignored).

-include .deploy.env

GHCR_OWNER ?= paxiimus
PROD_HOST  ?=
SSH_KEY    ?= ~/.ssh/antemortem_deploy
ADMIN_KEY  ?= ~/.ssh/antemortem_admin
PROD_API   ?= https://api.antemortem.example
APP_DIR    := /opt/antemortem
IMAGE      := ghcr.io/$(GHCR_OWNER)/antemortem-backend
SHA         = $(shell git rev-parse HEAD 2>/dev/null || echo nogit)

SSH    = ssh -i $(SSH_KEY) deploy@$(PROD_HOST)
# remote is double-quoted so single quotes inside ARGS/CMD pass through; escape as \$$ for a literal $.
remote = $(SSH) "cd $(APP_DIR) && $(1)"
ops    = $(call remote,./deploy.sh $(1))

.DEFAULT_GOAL := help
.PHONY: $(shell awk -F: '/^[a-z][a-z0-9_-]*:/ {print $$1}' $(MAKEFILE_LIST))

help:  ## Show targets
	@awk -F':.*##' '/^[a-z][a-z0-9_-]*:.*##/ {printf "  \033[36m%-18s\033[0m %s\n", $$1, $$2}' $(MAKEFILE_LIST)
	@printf "\nGHCR_OWNER=%s PROD_HOST=%s\n" "$(GHCR_OWNER)" "$(PROD_HOST)"

# ── Local ────────────────────────────────────────────────────────────
dev:  ## Local stack (Postgres, Redis, Django w/ auto-migrate, worker+beat)
	docker compose up

test:  ## Backend tests + crypto tests (incl. TS↔Python Shamir cross-check)
	cd backend && python manage.py test
	cd packages/crypto && npm test

setup-mobile:  ## Expo at latest SDK with compatible packages (UPGRADE=1 bumps SDK)
	./scripts/setup-mobile.sh $(if $(UPGRADE),--upgrade,)

# ── Deploy ───────────────────────────────────────────────────────────
push-backend:  ## Build + push image (NO_CACHE=1 to bypass layer cache)
	docker build $(if $(NO_CACHE),--no-cache,) -f backend/Dockerfile.prod --build-arg GIT_SHA=$(SHA) \
		-t $(IMAGE):main -t $(IMAGE):main-$(SHA) .
	docker push $(IMAGE):main-$(SHA) && docker push $(IMAGE):main

deploy-backend: check-config check-clean push-backend  ## Build → push → box pulls, migrates, restarts (NO_CACHE=1 for fresh)
	$(call ops,deploy main-$(SHA))
	@$(MAKE) -s health

deploy-mobile:  ## EAS Android preview (PLATFORM=ios for iOS; burns EAS minutes)
	cd app && eas build --platform $(or $(PLATFORM),android) --profile preview

# ── Operate ──────────────────────────────────────────────────────────
status:  ## Containers + health
	$(call ops,status)
logs:  ## Tail logs (SVC=backend|celery|celery-beat|caddy|db)
	$(call ops,logs $(or $(SVC),backend))
rollback:  ## Previous image
	$(call ops,rollback)
restart:  ## Restart services (SVC= for one)
	$(call ops,restart $(SVC))
restart-hard:  ## Force-recreate app + caddy (re-reads .env)
	$(call ops,restart-hard)
ssh:  ## Shell on the box
	$(SSH)
root-ssh:  ## Root shell via admin key (CMD='…' for one-off)
	ssh -i $(ADMIN_KEY) root@$(PROD_HOST) $(if $(CMD),"$(CMD)")
shell:  ## Django shell
	$(SSH) -t "cd $(APP_DIR) && ./deploy.sh shell"
dbshell:  ## psql
	$(SSH) -t "cd $(APP_DIR) && ./deploy.sh dbshell"
manage:  ## One-off manage.py at the deployed tag (ARGS='…')
	$(call ops,run backend python manage.py $(ARGS))

# ── Data ─────────────────────────────────────────────────────────────
backup:  ## pg_dump on the box
	$(call ops,backup)
backup-offsite:  ## age-encrypted dump → R2
	$(call ops,backup-offsite)
migrate:  ## Apply migrations
	$(call ops,run backend python manage.py migrate --noinput)
migrate-check:  ## Drift guard
	$(call ops,run backend python manage.py makemigrations --check --dry-run) && echo "✓ no drift"
superuser:  ## SU_USER= SU_EMAIL= SU_PASSWORD=
	@[ -n "$(SU_USER)" ] && [ -n "$(SU_EMAIL)" ] && [ -n "$(SU_PASSWORD)" ] || { echo "need SU_USER SU_EMAIL SU_PASSWORD"; exit 1; }
	$(call ops,run -e DJANGO_SUPERUSER_USERNAME='$(SU_USER)' -e DJANGO_SUPERUSER_EMAIL='$(SU_EMAIL)' -e DJANGO_SUPERUSER_PASSWORD='$(SU_PASSWORD)' backend python manage.py createsuperuser --noinput)

# ── Health ───────────────────────────────────────────────────────────
health:  ## Probe /api/health/ready/ via the public URL
	@curl -sf $(PROD_API)/api/health/ready/ | python3 -m json.tool || { echo "❌ health failed"; exit 1; }
smoke:  ## Black-box smoke against the public URL
	./scripts/post-deploy-smoke.sh $(PROD_API)
env-check:  ## Required vars present in the box's .env (no values shown)
	$(call ops,env-check)

# ── Sync ─────────────────────────────────────────────────────────────
sync:  ## Push deploy.sh, smoke, compose, Caddyfile to the box
	scp -i $(SSH_KEY) scripts/deploy.sh scripts/post-deploy-smoke.sh docker-compose.prod.yml Caddyfile deploy@$(PROD_HOST):$(APP_DIR)/
	$(call remote,chmod +x deploy.sh post-deploy-smoke.sh)
	@echo "compose/Caddyfile changes need: make restart-hard"

# ── Danger ───────────────────────────────────────────────────────────
db-reset: check-config  ## DESTRUCTIVE wipe (I_UNDERSTAND=destroy-production-data)
	@[ "$(I_UNDERSTAND)" = "destroy-production-data" ] || { echo "re-run with I_UNDERSTAND=destroy-production-data"; exit 1; }
	@printf "Type the prod host (%s): " "$(PROD_HOST)"; read H; [ "$$H" = "$(PROD_HOST)" ] || { echo aborted; exit 1; }
	$(SSH) -t "cd $(APP_DIR) && ./deploy.sh reset-db"

# ── Guards ───────────────────────────────────────────────────────────
check-config:
	@[ -n "$(PROD_HOST)" ] || { echo "PROD_HOST not set — create .deploy.env"; exit 1; }
check-clean:
	@[ "$(FORCE)" = "1" ] && exit 0; \
	 [ -z "$$(git status --porcelain)" ] || { git status -s; echo "dirty tree (FORCE=1 to bypass)"; exit 1; }; \
	 [ -z "$$(git log @{u}..HEAD 2>/dev/null)" ] || git push
