import express from 'express';
import cors from 'cors';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import 'dotenv/config';

const app = express();

// Создаем пул подключений через адаптер pg
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Health Check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Hello from CV Management API!' });
});

// ==================== ATTRIBUTE LIBRARY API ====================

// 1. Получить все атрибуты (с фильтрацией и поиском)
app.get('/api/attributes', async (req, res) => {
  try {
    const { category, search } = req.query;

    const whereClause: any = {};
    if (category) {
      whereClause.category = String(category);
    }
    if (search) {
      whereClause.name = {
        contains: String(search),
        mode: 'insensitive', // Поиск без учета регистра
      };
    }

    const attributes = await prisma.attribute.findMany({
      where: whereClause,
      orderBy: { name: 'asc' },
    });

    res.json(attributes);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch attributes' });
  }
});

// 2. Создать новый атрибут
app.post('/api/attributes', async (req, res) => {
  try {
    const { name, category, type, description } = req.body;

    const newAttribute = await prisma.attribute.create({
      data: { name, category, type, description },
    });

    res.status(201).json(newAttribute);
  } catch (error: any) {
    if (error.code === 'P2002') {
      return res.status(400).json({ error: 'Attribute with this name already exists' });
    }
    res.status(500).json({ error: 'Failed to create attribute' });
  }
});

// 3. Массовое удаление атрибутов (для тулбара)
app.post('/api/attributes/delete-many', async (req, res) => {
  try {
    const { ids } = req.body; // Массив ID для удаления

    await prisma.attribute.deleteMany({
      where: { id: { in: ids } },
    });

    res.json({ message: 'Attributes deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete attributes' });
  }
});

// ==================== PERSONAL PROFILE API ====================

// 1. Получение полного профиля пользователя
app.get('/api/profile/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    // Поищем пользователя или создадим тестового, если его еще нет
    let user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        projects: true,
        profileValues: {
          include: { attribute: true },
        },
      },
    });

    if (!user) {
      user = await prisma.user.create({
        data: {
          id: userId,
          email: 'candidate@example.com',
          firstName: 'John',
          lastName: 'Doe',
          role: 'CANDIDATE',
        },
        include: {
          projects: true,
          profileValues: {
            include: { attribute: true },
          },
        },
      });
    }

    res.json(user);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

// 2. Обновление значений атрибутов с Оптимистичной блокировкой (Optimistic Locking)
app.put('/api/profile/values', async (req, res) => {
  try {
    const { userId, attributeId, value, version } = req.body;

    // Ищем существующее значение
    const existingValue = await prisma.profileValue.findUnique({
      where: {
        userId_attributeId: { userId, attributeId },
      },
    });

    if (existingValue) {
      // Проверка версии для оптимистичной блокировки
      if (existingValue.version !== version) {
        return res.status(409).json({
          error: 'Conflict: Data was modified on another device/tab. Please refresh.',
        });
      }

      const updated = await prisma.profileValue.update({
        where: { id: existingValue.id },
        data: {
          value,
          version: { increment: 1 }, // Увеличиваем версию
        },
      });
      return res.json(updated);
    } else {
      // Создаем новое значение (начальная версия 1)
      const created = await prisma.profileValue.create({
        data: {
          userId,
          attributeId,
          value,
          version: 1,
        },
      });
      return res.json(created);
    }
  } catch (error) {
    res.status(500).json({ error: 'Failed to update profile value' });
  }
});

// 3. Добавление проекта
app.post('/api/projects', async (req, res) => {
  try {
    const { userId, name, startDate, endDate, description, tags } = req.body;

    const newProject = await prisma.project.create({
      data: {
        userId,
        name,
        startDate: new Date(startDate),
        endDate: endDate ? new Date(endDate) : null,
        description,
        tags,
      },
    });

    res.status(201).json(newProject);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create project' });
  }
});

// 4. Получение списка всех ранее введенных тегов (для автодополнения)
app.get('/api/tags', async (req, res) => {
  try {
    const projects = await prisma.project.findMany({
      select: { tags: true },
    });
    const allTags = Array.from(new Set(projects.flatMap((p) => p.tags)));
    res.json(allTags);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch tags' });
  }
});

// ==================== POSITIONS API ====================

// 1. Получить все вакансии
app.get('/api/positions', async (req, res) => {
  try {
    const positions = await prisma.position.findMany({
      include: {
        attributes: {
          include: { attribute: true },
        },
      },
    });
    res.json(positions);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch positions' });
  }
});

// 2. Создать вакансию с привязанными атрибутами
app.post('/api/positions', async (req, res) => {
  try {
    const { title, description, attributes } = req.body;
    // attributes -> [{ attributeId: string, isRequired: boolean, isHidden: boolean }]

    const newPosition = await prisma.position.create({
      data: {
        title,
        description,
        attributes: {
          create: attributes.map((attr: { attributeId: string; isRequired: boolean; isHidden: boolean }) => ({
            attributeId: attr.attributeId,
            isRequired: attr.isRequired,
            isHidden: attr.isHidden,
          })),
        },
      },
      include: {
        attributes: {
          include: { attribute: true },
        },
      },
    });

    res.status(201).json(newPosition);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create position' });
  }
});

// ==================== CV GENERATION API ====================

// Генерация CV под конкретную Вакансию
app.post('/api/cvs/generate', async (req, res) => {
  try {
    const { userId, positionId } = req.body;

    const position = await prisma.position.findUnique({
      where: { id: positionId },
      include: {
        attributes: {
          include: { attribute: true },
        },
      },
    });

    if (!position) {
      return res.status(404).json({ error: 'Position not found' });
    }

    const userProfileValues = await prisma.profileValue.findMany({
      where: { userId },
    });

    const userValueMap = new Map(userProfileValues.map((pv) => [pv.attributeId, pv.value]));

    const cvFields = position.attributes
      .filter((pa: any) => !pa.isHidden)
      .map((pa: any) => {
        const currentValue = userValueMap.get(pa.attributeId) || '';
        return {
          attributeId: pa.attributeId,
          name: pa.attribute.name,
          category: pa.attribute.category,
          isRequired: pa.isRequired,
          value: currentValue,
          isMissing: pa.isRequired && !currentValue.trim(),
        };
      });

    res.json({
      positionTitle: position.title,
      fields: cvFields,
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to generate CV' });
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});