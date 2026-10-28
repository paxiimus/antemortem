# Daeth Note

The death note app is a private E2E encrypted vault for:

- Storing passwords
- Storing Wills
- Storing any digital documents, media, and messages you want to keep private until your death.
- Sharing your secrets with trusted contacts after your death.
- Storing sensitive information like bank account details, insurance policies, and legal documents.
- Saying publicly in death things you couldn't say in life.

## Features

- End-to-end encryption ensures that only you and your trusted contacts can access your data.
- Secure sharing options allow you to designate who can access your vault after your death.
- User-friendly interface for easy management of your vault.
- Multi-device support so you can access your vault from anywhere. Mobile and Web App
- Browse public death notes left by others (anonymously if desired).
- Secure backup and recovery options to protect your data.
- Fine grained access controls to manage who can see what information after death.
-  a public-facing memorial/legacy page.

## Mobile app

The Death Note mobile app is available for both iOS and Android devices. It offers a seamless experience for managing your vault on the go.

- React Native
- Expo
- Expo Router for navigation
- Expo Packages where ever needed
- Jotai
- Screens
    - Home Screen: Overview of your vault and recent activity, subscription, storage usage cloud+local, and quick access to key features.
    - Vault Screen: Manage your stored data, add new entries, and organize your vault.
    - Sharing Screen: Set up sharing options and designate trusted contacts.
    - Public Death Notes Feed Screen: Browse public death notes left by others, search by usernames/location,  and filter by categories.
    - Friends to the End Screen: Manage your trusted contacts and view their public notes if they have any.
    - Settings/Account Screen: Manage your account settings, security options, and backup preferences.
    - Authentication Screen: Sign up, log in, and manage your authentication methods (e.g., 2FA).
    - Notifications Screen: View and manage notifications related to your vault and sharing activities.
    - Pricing and Payment Screen: View subscription options, manage your subscription, and handle billing information.
    - Legacy Page Screen: A public-facing page that can be shared with others to view your public notes and legacy information after your death.
- Tabbed Layout: Easy navigation between different sections of the app.


## Web app

The Death Note web app allows you to access your vault from any web browser. It provides the same features as the mobile app, ensuring you can manage your data from any device.

- React
- Next.js

## Backend

The backend of the Death Note app is built to ensure security, reliability, and scalability. It handles user authentication, data storage, and encryption.

- Django
- Django Rest Framework
- PostgreSQL
- Celery
- Redis
- AWS S3
