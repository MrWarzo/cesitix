import { Container, Title } from '@mantine/core';
import PedantixGame from './components/PedantixGame';

function HomePage() {
  return (
    <Container size="lg">
      <Title order={1} ta="center" mt="xl" mb="xl">
        Cesitix - Le jeu des articles Wikipédia
      </Title>
      <PedantixGame />
    </Container>
  );
}

export default HomePage;
