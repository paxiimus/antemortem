import { Tabs } from "expo-router";
import { C } from "@/ui";

const tab = (title: string) => ({ title, tabBarIcon: () => null });
export default function Layout() {
  return (
    <Tabs screenOptions={{ headerStyle: { backgroundColor: C.bg }, headerTintColor: C.fg, headerTitleStyle: { fontFamily: "Georgia" },
      tabBarStyle: { backgroundColor: C.bg, borderTopColor: C.line }, tabBarActiveTintColor: C.accent, tabBarInactiveTintColor: C.dim, tabBarLabelStyle: { fontSize: 13 } }}>
      <Tabs.Screen name="index" options={tab("Home")} />
      <Tabs.Screen name="vault" options={tab("Vault")} />
      <Tabs.Screen name="note" options={tab("Last words")} />
      <Tabs.Screen name="contacts" options={tab("Contacts")} />
      <Tabs.Screen name="settings" options={tab("Settings")} />
    </Tabs>
  );
}
