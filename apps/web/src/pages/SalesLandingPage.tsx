import { Alert, Badge, Card, Group, List, Stack, Text, ThemeIcon, Title } from "@mantine/core";
import {
  IconBolt,
  IconChecklist,
  IconClockHour4,
  IconLayoutKanban,
  IconMessageCircle2,
  IconRouteAltLeft,
  IconShieldCheck,
  IconUsers,
} from "@tabler/icons-react";

export function SalesLandingPage() {
  return (
    <Stack gap="xl">
      <Stack gap="sm">
        <Group gap="xs">
          <Badge variant="light" color="blue" size="lg">
            Для производства фасадов
          </Badge>
          <Badge variant="light" color="green" size="lg">
            Понятно без IT-терминов
          </Badge>
        </Group>
        <Title order={2}>ERM, который помогает цеху работать спокойно и без хаоса</Title>
        <Text c="dimmed" maw={900}>
          Это рабочая система для производства фасадов: видно каждый заказ, на каком он этапе, кто с ним работает и где
          возникает задержка. Руководитель получает контроль, а сотрудники - понятный порядок действий.
        </Text>
      </Stack>

      <Alert color="blue" variant="light" icon={<IconMessageCircle2 size={18} />}>
        Если сказать просто: вместо звонков, бумажек и переписок в мессенджерах у вас один общий экран, где видно всю
        картину по производству.
      </Alert>

      <Stack gap="md">
        <Card withBorder radius="md" p="lg">
          <Stack gap="sm">
            <Group gap="sm">
              <ThemeIcon variant="light" color="cyan" radius="md" size={34}>
                <IconLayoutKanban size={18} />
              </ThemeIcon>
              <Title order={4}>Канбан по цеху</Title>
            </Group>
            <Text size="sm" c="dimmed">
              Все заказы лежат по этапам производства в виде карточек. Карточку можно просто перетащить дальше по
              процессу.
            </Text>
            <List size="sm" spacing="xs">
              <List.Item>Сразу видно, где скапливается очередь.</List.Item>
              <List.Item>Легко понять, что горит по срокам.</List.Item>
              <List.Item>Меньше потерь времени на уточнения между участками.</List.Item>
            </List>
          </Stack>
        </Card>

        <Card withBorder radius="md" p="lg">
          <Stack gap="sm">
            <Group gap="sm">
              <ThemeIcon variant="light" color="blue" radius="md" size={34}>
                <IconChecklist size={18} />
              </ThemeIcon>
              <Title order={4}>Одна карточка заказа</Title>
            </Group>
            <Text size="sm" c="dimmed">
              В заказе собрана вся нужная информация: состав фасадов, размеры, покрытие, комментарии и текущий этап.
            </Text>
            <List size="sm" spacing="xs">
              <List.Item>Сотрудники не ищут данные по разным чатам и файлам.</List.Item>
              <List.Item>Меньше ошибок из-за устных договоренностей.</List.Item>
              <List.Item>Любой ответственный быстро понимает, что делать дальше.</List.Item>
            </List>
          </Stack>
        </Card>

        <Card withBorder radius="md" p="lg">
          <Stack gap="sm">
            <Group gap="sm">
              <ThemeIcon variant="light" color="teal" radius="md" size={34}>
                <IconRouteAltLeft size={18} />
              </ThemeIcon>
              <Title order={4}>Раскрой и рабочие документы</Title>
            </Group>
            <Text size="sm" c="dimmed">
              Система подготавливает раскрой по заказу и формирует файл для работы. Цех получает понятные данные для
              запуска в производство.
            </Text>
            <List size="sm" spacing="xs">
              <List.Item>Быстрее подготовка заказа к запуску.</List.Item>
              <List.Item>Меньше ручной рутины и перепроверок.</List.Item>
              <List.Item>Снижается риск пропустить важные параметры.</List.Item>
            </List>
          </Stack>
        </Card>

        <Card withBorder radius="md" p="lg">
          <Stack gap="sm">
            <Group gap="sm">
              <ThemeIcon variant="light" color="orange" radius="md" size={34}>
                <IconClockHour4 size={18} />
              </ThemeIcon>
              <Title order={4}>Учет времени по этапам</Title>
            </Group>
            <Text size="sm" c="dimmed">
              По заказам фиксируется фактическое время работ. Это помогает понять реальную загрузку людей и участков.
            </Text>
            <List size="sm" spacing="xs">
              <List.Item>Видно, куда уходит больше всего часов.</List.Item>
              <List.Item>Проще находить узкие места в процессе.</List.Item>
              <List.Item>Легче планировать смены и объемы.</List.Item>
            </List>
          </Stack>
        </Card>

        <Card withBorder radius="md" p="lg">
          <Stack gap="sm">
            <Group gap="sm">
              <ThemeIcon variant="light" color="violet" radius="md" size={34}>
                <IconChecklist size={18} />
              </ThemeIcon>
              <Title order={4}>Отчеты с большими возможностями</Title>
            </Group>
            <Text size="sm" c="dimmed">
              Сейчас в системе уже есть базовые отчеты для старта. Это фундамент, который можно развивать под любые
              управленческие задачи вашего производства.
            </Text>
            <List size="sm" spacing="xs">
              <List.Item>Можно строить отчеты по срокам, этапам, сотрудникам, участкам, типам фасадов и заказчикам.</List.Item>
              <List.Item>Можно добавлять нужные фильтры, периоды, сводки и сравнение с прошлым периодом.</List.Item>
              <List.Item>Отчеты можно дорабатывать под ваши бизнес-вопросы, а не под шаблон "как у всех".</List.Item>
            </List>
          </Stack>
        </Card>
      </Stack>

      <Card withBorder radius="md" p="lg">
        <Stack gap="md">
          <Group gap="sm">
            <ThemeIcon variant="light" color="grape" radius="md" size={34}>
              <IconUsers size={18} />
            </ThemeIcon>
            <Title order={4}>Польза для каждого в компании</Title>
          </Group>
          <Stack gap="sm">
            <Stack gap={4}>
              <Text fw={700}>Руководитель</Text>
              <Text size="sm" c="dimmed">
                Видит общую картину по производству и быстро понимает, где нужна помощь команде.
              </Text>
            </Stack>
            <Stack gap={4}>
              <Text fw={700}>Сотрудник цеха</Text>
              <Text size="sm" c="dimmed">
                Работает по понятному маршруту заказа, без постоянных уточнений и лишних переключений.
              </Text>
            </Stack>
            <Stack gap={4}>
              <Text fw={700}>Заказчик</Text>
              <Text size="sm" c="dimmed">
                Может посмотреть статус своего заказа и не дергать менеджера по каждому вопросу.
              </Text>
            </Stack>
          </Stack>
        </Stack>
      </Card>

      <Card withBorder radius="md" p="lg">
        <Group align="flex-start" gap="sm">
          <ThemeIcon variant="light" color="green" radius="md" size={34}>
            <IconShieldCheck size={18} />
          </ThemeIcon>
          <Stack gap={4}>
            <Title order={4}>Почему это удобно внедрять</Title>
            <Text size="sm" c="dimmed">
              Команда начинает работать в привычной логике "заказ - этап - выполнение". Интерфейс визуальный и
              понятный: не нужно быть IT-специалистом, чтобы контролировать производство.
            </Text>
          </Stack>
        </Group>
      </Card>

      <Card withBorder radius="md" p="lg">
        <Stack gap="md">
          <Group gap="sm">
            <ThemeIcon variant="light" color="blue" radius="md" size={34}>
              <IconShieldCheck size={18} />
            </ThemeIcon>
            <Title order={4}>Платформа поддерживаемая и развиваемая</Title>
          </Group>
          <Text size="sm" c="dimmed">
            Это не разовая "самописка на коленке", а рабочая платформа, которую можно сопровождать, улучшать и
            наращивать по мере роста компании.
          </Text>
          <List size="sm" spacing="xs">
            <List.Item>Можно постепенно добавлять новые модули без остановки текущей работы цеха.</List.Item>
            <List.Item>Изменения внедряются поэтапно: сначала самое важное, затем расширения.</List.Item>
            <List.Item>Система подходит для долгой эксплуатации и развития вместе с вашим производством.</List.Item>
          </List>
        </Stack>
      </Card>

      <Card withBorder radius="md" p="lg">
        <Stack gap="md">
          <Title order={4}>Что можно добавить в дальнейшем</Title>
          <List size="sm" spacing="xs">
            <List.Item>План-факт по срокам: где и почему теряются дни.</List.Item>
            <List.Item>Отчеты по загрузке участков на неделю и месяц вперед.</List.Item>
            <List.Item>Контроль узких мест и автоматические подсказки по очереди работ.</List.Item>
            <List.Item>Уведомления для менеджера и цеха о критичных задержках.</List.Item>
            <List.Item>Расширенные KPI по производительности сотрудников и этапов.</List.Item>
            <List.Item>Дополнительные формы печати и выгрузки для внутренней отчетности.</List.Item>
          </List>
        </Stack>
      </Card>

      <Alert color="teal" variant="light" icon={<IconBolt size={18} />}>
        Главный результат: меньше хаоса в цеху, понятные процессы и прозрачный контроль заказов каждый день.
      </Alert>
    </Stack>
  );
}
