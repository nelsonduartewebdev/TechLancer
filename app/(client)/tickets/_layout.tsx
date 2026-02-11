import { Stack } from 'expo-router';

export default function TicketsLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: true,
        headerBackTitle: 'Voltar',
      }}
    >
      <Stack.Screen
        name="index"
        options={{
          title: 'Os Meus Pedidos',
          headerShadowVisible: false,
        }}
      />
      <Stack.Screen
        name="new-ticket"
        options={{
          title: 'Novo Pedido',
          headerShadowVisible: false,
        }}
      />
      <Stack.Screen
        name="[id]"
        options={{
          title: 'Detalhe do Pedido',
          headerShadowVisible: false,
        }}
      />
    </Stack>
  );
}
