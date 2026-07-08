const express = require('express');
const app = express();
const PORT = process.env.PORT || 5000;

app.use(express.json());

app.get('/api/notify/health', (req, res) => {
  res.json({ status: 'healthy' });
});

app.post('/api/notify/send', (req, res) => {
  const { patientName, status, doctorName } = req.body;
  if (!patientName) {
    return res.status(400).json({ error: 'Missing patientName in request body' });
  }

  const appStatus = status || 'Pending';
  const docName = doctorName || 'Doctor';

  // Format alert message depending on status check
  if (appStatus === 'Confirmed' || appStatus === 'Approved') {
    console.log(`[ALERT] Email/SMS sent to ${patientName}: Your appointment with ${docName} is Confirmed!`);
  } else if (appStatus === 'Rejected') {
    console.log(`[ALERT] Email/SMS sent to ${patientName}: Your appointment with ${docName} is Rejected.`);
  } else {
    console.log(`[ALERT] Booking notification sent to patient: ${patientName} - Appointment with ${docName} is Pending Approval.`);
  }
  
  res.json({
    status: 'sent',
    message: `Notification sent to ${patientName} with status ${appStatus}`
  });
});

app.listen(PORT, () => {
  console.log(`Notification Service running on port ${PORT}`);
});
