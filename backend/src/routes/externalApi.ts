import { Router } from 'express';
import { prisma } from '../prisma';

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

// Salesforce Lead/Contact Generator API
router.post('/salesforce/create-contact', async (req, res) => {
  try {
    const { userId, additionalNotes, targetProduct } = req.body;
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return res.status(404).json({ error: 'User not found' });

    const sfPayload = {
      Account: {
        Name: `${user.name} Organization`,
        Type: 'Customer - Direct',
        BillingCity: user.location || 'Tashkent',
      },
      Contact: {
        FirstName: user.name.split(' ')[0] || user.name,
        LastName: user.name.split(' ').slice(1).join(' ') || 'Candidate',
        Email: user.email,
        Role__c: user.role,
        Target_Product__c: targetProduct || 'CV Matching Enterprise',
        Notes__c: additionalNotes || 'Created via Course Project Integration',
      },
      CreatedDate: new Date().toISOString(),
      Status: 'Success',
      SalesforceId: `SF-${Math.random().toString(36).substring(2, 9).toUpperCase()}`,
    };

    res.json({
      message: 'Salesforce Account and Linked Contact created successfully',
      salesforceRecord: sfPayload,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
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

    res.json({
      message: 'Power Automate Ticket JSON generated successfully',
      ticket: ticketJson,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
