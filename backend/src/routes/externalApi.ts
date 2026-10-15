import { Router } from 'express';
import { prisma } from '../prisma';
import { createSalesforceAccountContact, verifySalesforceConnection, SalesforceError } from '../services/salesforce';
import { getPublicSalesforceStatus } from '../services/salesforceStatus';
import { authenticate, requireIntegrationAdmin, AuthRequest } from '../middleware/auth';
import { uploadToDropbox } from '../services/dropbox';

const router = Router();

// Odoo External API Endpoint by apiToken
router.get('/odoo/position-data/:apiToken', async (req, res) => {
  try {
    const { apiToken } = req.params;

    const position = await prisma.position.findUnique({
      where: { apiToken },
      include: {
        attributes: {
          include: { attribute: { include: { category: true } } },
        },
        cvs: {
          where: { isPublished: true },
          include: { candidate: true },
        },
      },
    });

    if (!position) {
      return res.status(404).json({ error: 'Invalid API token or position not found' });
    }

    // Fetch candidate attribute values for all published candidates for this position
    const candidateIds = position.cvs.map((c) => c.candidateId);
    const attrValues = await prisma.candidateAttributeValue.findMany({
      where: { candidateId: { in: candidateIds } },
    });

    // Group values by attribute ID to compute aggregate stats
    const aggregates: Array<{
      attributeId: string;
      attributeName: string;
      dataType: string;
      category: string;
      count: number;
      min?: number;
      max?: number;
      avg?: number;
      popularValues?: Array<{ value: string; count: number }>;
    }> = [];

    for (const pa of position.attributes) {
      const vals = attrValues.filter((v) => v.attributeId === pa.attributeId && v.value);
      const valStrings = vals.map((v) => v.value);

      const item: any = {
        attributeId: pa.attribute.id,
        attributeName: pa.attribute.name,
        dataType: pa.attribute.dataType,
        category: pa.attribute.category.name,
        count: vals.length,
      };

      if (pa.attribute.dataType === 'NUMERIC') {
        const nums = valStrings.map((v) => parseFloat(v)).filter((n) => !isNaN(n));
        if (nums.length > 0) {
          item.min = Math.min(...nums);
          item.max = Math.max(...nums);
          item.avg = parseFloat((nums.reduce((a, b) => a + b, 0) / nums.length).toFixed(2));
        }
      } else {
        const counts: Record<string, number> = {};
        valStrings.forEach((v) => {
          counts[v] = (counts[v] || 0) + 1;
        });
        item.popularValues = Object.entries(counts)
          .map(([value, count]) => ({ value, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 3);
      }

      aggregates.push(item);
    }

    res.json({
      success: true,
      position: {
        id: position.id,
        title: position.title,
        description: position.description,
        totalSubmittedCVs: position.cvs.length,
        apiToken: position.apiToken,
      },
      attributes: position.attributes.map((pa) => ({
        id: pa.attribute.id,
        name: pa.attribute.name,
        dataType: pa.attribute.dataType,
        category: pa.attribute.category.name,
      })),
      aggregatedResults: aggregates,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// The public demo exposes only a cached read-only connection result, never CRM data or credentials.
router.get('/salesforce/status', async (_req, res) => {
  res.set('Cache-Control', 'no-store');
  res.json(await getPublicSalesforceStatus());
});

// Salesforce Account/Contact Generator API
router.use('/salesforce', authenticate, requireIntegrationAdmin);

router.post('/salesforce/create-contact', async (req: AuthRequest, res) => {
  try {
    if (process.env.SF_WRITES_ENABLED !== 'true') {
      return res.status(403).json({ error: 'Salesforce record creation is disabled.' });
    }
    const { userId, additionalNotes, targetProduct } = req.body;
    if (userId !== undefined && userId !== req.user!.id) {
      return res.status(403).json({ error: 'Only your own profile can be exported.' });
    }
    if ((additionalNotes !== undefined && (typeof additionalNotes !== 'string' || additionalNotes.length > 2000)) ||
        (targetProduct !== undefined && (typeof targetProduct !== 'string' || targetProduct.length > 160))) {
      return res.status(400).json({ error: 'Invalid product or notes. Maximum lengths are 160 and 2000 characters.' });
    }
    const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
    if (!user) return res.status(404).json({ error: 'User not found' });

    const [firstName, ...rest] = user.name.split(' ');
    const records = await createSalesforceAccountContact({
      Name: `${user.name} Organization`,
      Type: 'Customer - Direct',
      BillingCity: user.location || 'Tashkent',
    }, {
      FirstName: firstName || user.name,
      LastName: rest.join(' ') || 'Candidate',
      Email: user.email,
      Description: `Role: ${user.role}. Target: ${targetProduct || 'CV Matching'}. Notes: ${additionalNotes || ''}`,
    });

    res.json({
      message: 'Salesforce Account and Contact created successfully',
      ...records,
    });
  } catch (err) {
    res.status(err instanceof SalesforceError ? err.status : 500).json({
      error: err instanceof SalesforceError ? err.message : 'Salesforce export could not be completed.',
    });
  }
});

router.get('/salesforce/test-auth', async (req, res) => {
  try {
    res.json(await verifySalesforceConnection());
  } catch (err) {
    res.status(err instanceof SalesforceError ? err.status : 500).json({
      error: err instanceof SalesforceError ? err.message : 'Salesforce connection could not be verified.',
    });
  }
});

// Power Automate Support Ticket Generator

router.post('/power-automate/create-ticket', async (req, res) => {
  try {
    const { reportedBy, userRole, positionTitle, pageLink, priority, summary, adminEmail } = req.body;

    const ticketJson = {
      TicketId: `PA-${Date.now()}`,
      "Reported by": `${reportedBy} (${userRole})`,
      Position: positionTitle || 'N/A',
      Link: pageLink || 'http://localhost:5173',
      Priority: priority || 'Average',
      Summary: summary,
      AdminsEmail: adminEmail || 'admin@example.com',
      Timestamp: new Date().toISOString(),
    };

    const fileName = `ticket-${ticketJson.TicketId}.json`;
    await uploadToDropbox(fileName, ticketJson);

    res.json({
      message: 'Support ticket generated and uploaded to Dropbox successfully',
      ticket: ticketJson,
      fileName,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
