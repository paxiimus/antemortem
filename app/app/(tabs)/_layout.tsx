import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { C, F } from "@/ui";

type Icon = keyof typeof Ionicons.glyphMap;
const tab = (title: string, icon: Icon) => ({
  title,
  tabBarIcon: ({ color, focused }: { color: string; focused: boolean }) =>
    <Ionicons name={(focused ? icon.replace("-outline", "") : icon) as Icon} size={22} color={color} />,
});

export default function Layout() {
  return (
    <Tabs screenOptions={{
      headerShown: false,
      sceneStyle: { backgroundColor: C.bg },
      tabBarStyle: { backgroundColor: C.bg, borderTopColor: C.line },
      tabBarActiveTintColor: C.ember,
      tabBarInactiveTintColor: C.faint,
      tabBarLabelStyle: { fontFamily: F.monoMed, fontSize: 9.5, letterSpacing: 0.9, textTransform: "uppercase" },
    }}>
      <Tabs.Screen name="index" options={tab("Home", "pulse-outline")} />
      <Tabs.Screen name="note" options={tab("Last words", "reader-outline")} />
      <Tabs.Screen name="vault" options={tab("Vault", "lock-closed-outline")} />
      <Tabs.Screen name="contacts" options={tab("Contacts", "people-outline")} />
      <Tabs.Screen name="settings" options={tab("Settings", "options-outline")} />
    </Tabs>
  );
}
