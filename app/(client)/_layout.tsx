import { Tabs } from 'expo-router';

export default function ClientLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#111827',
      }}
    >
      <Tabs.Screen
        name="tickets"
        options={{
          title: 'Os Meus Pedidos',
          tabBarLabel: 'Início',
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Perfil',
          tabBarLabel: 'Perfil',
        }}
      />
    </Tabs>
  );
}
