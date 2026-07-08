const express = require('express');
const app = express();
const PORT = process.env.PORT || 6000;

app.use(express.json());

// In-memory invoice storage
const INVOICES = [];

app.get('/api/billing/health', (req, res) => {
  res.json({ status: 'healthy' });
});

app.get('/api/billing/invoices', (req, res) => {
  const { patientName } = req.query;
  if (patientName) {
    const filtered = INVOICES.filter(inv => 
      inv.patientName.toLowerCase().includes(patientName.toLowerCase())
    );
    return res.json(filtered);
  }
  res.json(INVOICES);
});

app.post('/api/billing/invoice', (req, res) => {
  const { patientName } = req.body;
  if (!patientName) {
    return res.status(400).json({ error: 'Missing patientName in request body' });
  }

  const invoiceId = `INV-${Math.floor(1000 + Math.random() * 9000)}`;
  const amount = 150.00;
  const newInvoice = {
    invoiceId,
    patientName,
    amount,
    date: new Date().toLocaleDateString(),
    status: 'Unpaid'
  };

  INVOICES.push(newInvoice);

  // Console output action for observability checks
  console.log(`[BILLING] Mock invoice generated for patient ${patientName} - Total: $${amount.toFixed(2)} (Invoice ID: ${invoiceId})`);

  res.json({
    status: 'success',
    invoice: newInvoice,
    message: `Invoice generated for ${patientName}`
  });
});

app.put('/api/billing/invoices/:invoiceId/pay', (req, res) => {
  const { invoiceId } = req.params;
  const invoice = INVOICES.find(inv => inv.invoiceId === invoiceId);
  if (!invoice) {
    return res.status(404).json({ error: `Invoice ${invoiceId} not found` });
  }

  invoice.status = 'Paid';
  console.log(`[BILLING] Invoice ${invoiceId} has been PAID by patient ${invoice.patientName}.`);

  res.json({
    status: 'success',
    invoice: invoice,
    message: `Invoice ${invoiceId} marked as paid`
  });
});

app.listen(PORT, () => {
  console.log(`Billing Service running on port ${PORT}`);
});
