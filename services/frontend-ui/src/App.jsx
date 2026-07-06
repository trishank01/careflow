import React, { useState, useEffect } from 'react'

function App() {
  const [token, setToken] = useState(localStorage.getItem('token') || '')
  const [isRegisterMode, setIsRegisterMode] = useState(false)
  const [username, setUsername] = useState('harsh') // Default to a patient test account
  const [password, setPassword] = useState('patient123')
  const [registerRole, setRegisterRole] = useState('patient') // Used for signup
  const [role, setRole] = useState(localStorage.getItem('role') || 'patient') // Holds active role ("patient" / "doctor")
  const [authError, setAuthError] = useState('')
  const [authSuccess, setAuthSuccess] = useState('')

  const [patientName, setPatientName] = useState('')
  const [doctorName, setDoctorName] = useState('')
  const [appointmentTime, setAppointmentTime] = useState('10:00 AM')
  const [appointments, setAppointments] = useState([])
  const [doctorsList, setDoctorsList] = useState([]) // Dynamically loaded doctors
  const [invoices, setInvoices] = useState([])
  const [message, setMessage] = useState('')
  const [fetchError, setFetchError] = useState('')

  // Determine user role and mapping
  const loggedInUser = localStorage.getItem('username') || ''
  const isDoctor = role === 'doctor'
  
  const getDoctorDisplayName = (user) => {
    if (user === 'dr_smith') return 'Dr. Smith'
    if (user === 'dr_jones') return 'Dr. Jones'
    if (user === 'dr_patel') return 'Dr. Patel'
    if (user.startsWith('dr_')) {
      const suffix = user.substring(3);
      return 'Dr. ' + suffix.charAt(0).toUpperCase() + suffix.slice(1);
    }
    return 'Dr. Smith' // Fallback
  }

  const doctorDisplayName = getDoctorDisplayName(loggedInUser)

  useEffect(() => {
    // Fetch doctors list for the booking dropdown
    fetchDoctors()
  }, [])

  useEffect(() => {
    if (token) {
      fetchAppointments()
      fetchDoctors()
      if (!isDoctor) {
        fetchInvoices()
      }
    }
  }, [token, role])

  // Pre-fill patient name field for logged in patients
  useEffect(() => {
    if (token && !isDoctor) {
      setPatientName(loggedInUser)
    }
  }, [token, loggedInUser, isDoctor])

  const fetchDoctors = async () => {
    try {
      const res = await fetch('/api/auth/doctors')
      if (res.ok) {
        const data = await res.json()
        setDoctorsList(data)
        if (data.length > 0) {
          setDoctorName(data[0].displayName)
        }
      }
    } catch (err) {
      console.error('Error fetching doctors:', err)
    }
  }

  const fetchAppointments = async () => {
    try {
      setFetchError('')
      const res = await fetch('/api/appointments', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      if (res.ok) {
        const data = await res.json()
        setAppointments(data)
      } else {
        setFetchError('Failed to fetch appointments. Log in again.')
        if (res.status === 401) {
          handleLogout()
        }
      }
    } catch (err) {
      setFetchError('Error connecting to appointment service.')
    }
  }

  const fetchInvoices = async () => {
    try {
      const res = await fetch(`/api/billing/invoices?patientName=${loggedInUser}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      if (res.ok) {
        const data = await res.json()
        setInvoices(data)
      }
    } catch (err) {
      console.error('Error fetching invoices:', err)
    }
  }

  const handlePayInvoice = async (invoiceId) => {
    setMessage('')
    try {
      const res = await fetch(`/api/billing/invoices/${invoiceId}/pay`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      })

      if (res.ok) {
        setMessage(`Invoice ${invoiceId} paid successfully!`)
        fetchInvoices()
      } else {
        const data = await res.json().catch(() => ({}))
        setMessage(data.error || 'Payment failed.')
      }
    } catch (err) {
      setMessage('Error connecting to billing service.')
    }
  }

  const handleAuthSubmit = async (e) => {
    e.preventDefault()
    setAuthError('')
    setAuthSuccess('')

    const endpoint = isRegisterMode ? '/api/auth/register' : '/api/auth/login'
    const payload = isRegisterMode 
      ? { username, password, role: registerRole }
      : { username, password }
    
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      const data = await res.json()
      if (res.ok) {
        if (isRegisterMode) {
          setAuthSuccess('Registration successful! Please log in.')
          setIsRegisterMode(false)
          setPassword('')
          fetchDoctors() // Refresh doctor dropdown in case a new doctor signed up
        } else {
          setToken(data.token)
          setRole(data.role || 'patient')
          localStorage.setItem('token', data.token)
          localStorage.setItem('username', username)
          localStorage.setItem('role', data.role || 'patient')
        }
      } else {
        setAuthError(data.detail || 'Authentication operation failed.')
      }
    } catch (err) {
      setAuthError(`Error connecting to auth service during ${isRegisterMode ? 'registration' : 'login'}.`)
    }
  }

  const handleLogout = () => {
    setToken('')
    setRole('patient')
    localStorage.removeItem('token')
    localStorage.removeItem('username')
    localStorage.removeItem('role')
    setAppointments([])
    setInvoices([])
    setAuthSuccess('')
    setAuthError('')
  }

  const handleBook = async (e) => {
    e.preventDefault()
    setMessage('')
    if (!patientName.trim()) {
      setMessage('Please enter a patient name.')
      return
    }

    try {
      const res = await fetch('/api/appointments', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          patientName: patientName.trim(),
          doctorName,
          appointmentTime,
          status: 'Pending'
        })
      })

      if (res.ok) {
        setMessage('Appointment booking submitted! Pending doctor approval.')
        fetchAppointments()
        fetchInvoices() // Refresh invoices as booking generates a bill
      } else {
        const data = await res.json().catch(() => ({}))
        setMessage(data.detail || 'Booking failed. Try again.')
      }
    } catch (err) {
      setMessage('Error connecting to appointment service.')
    }
  }

  const handleUpdateStatus = async (id, newStatus) => {
    setMessage('')
    try {
      const res = await fetch(`/api/appointments/${id}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ status: newStatus })
      })

      if (res.ok) {
        setMessage(`Appointment #${id} updated to: ${newStatus}`)
        fetchAppointments()
      } else {
        const data = await res.json().catch(() => ({}))
        setMessage(data.detail || 'Failed to update status.')
      }
    } catch (err) {
      setMessage('Error updating appointment status.')
    }
  }

  // Filter logic: Patients see ONLY their own bookings; Doctors see ONLY bookings assigned to them (or all if admin)
  const filteredAppointments = isDoctor
    ? (loggedInUser === 'admin' ? appointments : appointments.filter(app => app.doctorName === doctorDisplayName))
    : appointments.filter(app => app.patientName.toLowerCase() === loggedInUser.toLowerCase())

  if (!token) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <div className="card" style={{ width: '400px' }}>
          <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
            <span style={{ fontSize: '3rem' }}>🏥</span>
            <h2 style={{ margin: '0.5rem 0 0', color: 'var(--primary-color)' }}>CareFlow Portal</h2>
            <p style={{ color: '#6b7280', fontSize: '0.875rem' }}>
              {isRegisterMode ? 'Create your medical portal account' : 'Please log in to manage appointments'}
            </p>
          </div>
          <form onSubmit={handleAuthSubmit}>
            <div className="form-group">
              <label>Username</label>
              <input 
                type="text" 
                className="form-control" 
                placeholder={isRegisterMode && registerRole === 'doctor' ? "e.g. dr_smith, dr_watson" : "e.g. harsh, ajay"}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
            </div>
            
            {/* Show Role selection dropdown during Registration only */}
            {isRegisterMode && (
              <div className="form-group">
                <label>Account Type (Role)</label>
                <select 
                  className="form-control"
                  value={registerRole}
                  onChange={(e) => {
                    setRegisterRole(e.target.value)
                    if (e.target.value === 'doctor') {
                      setUsername('dr_')
                    } else {
                      setUsername('')
                    }
                  }}
                >
                  <option value="patient">Patient (Request Bookings & View Bills)</option>
                  <option value="doctor">Doctor (Approve & Reject Appointments)</option>
                </select>
                {registerRole === 'doctor' && (
                  <p style={{ color: '#6b7280', fontSize: '0.75rem', marginTop: '0.25rem' }}>
                    💡 <em>Tip: Please prefix your username with <strong>dr_</strong> (e.g. dr_roberts) to auto-configure your display name correctly.</em>
                  </p>
                )}
              </div>
            )}

            <div className="form-group">
              <label>Password</label>
              <input 
                type="password" 
                className="form-control" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            {authError && <p style={{ color: '#ef4444', fontSize: '0.875rem', marginTop: '0.5rem' }}>{authError}</p>}
            {authSuccess && <p style={{ color: '#047857', fontSize: '0.875rem', marginTop: '0.5rem' }}>{authSuccess}</p>}
            <button type="submit" className="btn" style={{ marginTop: '1rem' }}>
              {isRegisterMode ? 'Register Account' : 'Log In'}
            </button>
          </form>
          <div style={{ marginTop: '1.5rem', textAlign: 'center' }}>
            <button 
              onClick={() => {
                setIsRegisterMode(!isRegisterMode)
                setAuthError('')
                setAuthSuccess('')
                // Reset defaults based on toggled mode
                if (!isRegisterMode) {
                  setUsername('')
                  setPassword('')
                  setRegisterRole('patient')
                } else {
                  setUsername('harsh')
                  setPassword('patient123')
                }
              }}
              style={{ border: 'none', background: 'none', color: 'var(--primary-color)', cursor: 'pointer', fontSize: '0.875rem', textDecoration: 'underline' }}
            >
              {isRegisterMode ? 'Already have an account? Log In' : "Don't have an account? Register"}
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="header">
        <h1>🏥 CareFlow Patient Portal</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <span style={{ fontSize: '0.875rem', color: '#4b5563' }}>
            Logged in as <strong>{loggedInUser}</strong> ({isDoctor ? 'Doctor' : 'Patient'})
          </span>
          <button onClick={handleLogout} className="btn" style={{ width: 'auto', padding: '0.5rem 1rem', backgroundColor: '#e5e7eb', color: '#1f2937' }}>Log Out</button>
        </div>
      </div>

      <div className="container">
        <div className="grid" style={isDoctor ? { gridTemplateColumns: '1fr' } : {}}>
          
          {/* Left Column - Book Appointment (Patients Only) */}
          {!isDoctor && (
            <div className="card">
              <h3 style={{ margin: '0 0 1.5rem', color: 'var(--primary-color)' }}>Book Appointment</h3>
              <form onSubmit={handleBook}>
                <div className="form-group">
                  <label>Patient Name (Your Username)</label>
                  <input 
                    type="text" 
                    className="form-control"
                    value={patientName}
                    onChange={(e) => setPatientName(e.target.value)}
                    disabled
                  />
                </div>
                <div className="form-group">
                  <label>Doctor</label>
                  <select 
                    className="form-control"
                    value={doctorName}
                    onChange={(e) => setDoctorName(e.target.value)}
                  >
                    {doctorsList.map((doc) => (
                      <option key={doc.username} value={doc.displayName}>
                        {doc.displayName}
                      </option>
                    ))}
                    {doctorsList.length === 0 && (
                      <>
                        <option value="Dr. Smith">Dr. Smith (General Medicine)</option>
                        <option value="Dr. Jones">Dr. Jones (Cardiology)</option>
                        <option value="Dr. Patel">Dr. Patel (Pediatrics)</option>
                      </>
                    )}
                  </select>
                </div>
                <div className="form-group">
                  <label>Preferred Time</label>
                  <select 
                    className="form-control"
                    value={appointmentTime}
                    onChange={(e) => setAppointmentTime(e.target.value)}
                  >
                    <option value="09:00 AM">09:00 AM</option>
                    <option value="10:00 AM">10:00 AM</option>
                    <option value="11:00 AM">11:00 AM</option>
                    <option value="02:00 PM">02:00 PM</option>
                    <option value="03:00 PM">03:00 PM</option>
                  </select>
                </div>
                <button type="submit" className="btn">Submit Request</button>
              </form>
              {message && <p style={{ fontSize: '0.875rem', marginTop: '1rem', color: (message.includes('success') || message.includes('submitted') || message.includes('updated')) ? '#047857' : '#ef4444' }}>{message}</p>}
            </div>
          )}

          {/* Right Column - Schedule Board (All Users) */}
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h3 style={{ margin: 0, color: 'var(--primary-color)' }}>
                {isDoctor ? 'Doctor Approval Board' : 'My Scheduled Appointments'}
              </h3>
              <button onClick={fetchAppointments} style={{ border: 'none', background: 'none', color: 'var(--primary-color)', cursor: 'pointer', fontWeight: 600 }}>🔄 Refresh</button>
            </div>

            {fetchError && <p style={{ color: '#ef4444' }}>{fetchError}</p>}

            {filteredAppointments.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '3rem 0', color: '#6b7280' }}>
                <p style={{ margin: 0, fontSize: '1.25rem' }}>No bookings found</p>
                <p style={{ margin: '0.5rem 0 0', fontSize: '0.875rem' }}>
                  {isDoctor ? 'No appointments have been requested.' : 'Book an appointment on the left.'}
                </p>
              </div>
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Patient Name</th>
                    <th>Doctor</th>
                    <th>Time</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAppointments.map((app) => (
                    <tr key={app.id}>
                      <td><strong>#{app.id}</strong></td>
                      <td>{app.patientName}</td>
                      <td>{app.doctorName}</td>
                      <td>{app.appointmentTime}</td>
                      <td>
                        <span className={`badge ${
                          app.status === 'Confirmed' || app.status === 'Approved' ? 'badge-success' : 
                          app.status === 'Rejected' ? 'badge-danger' : ''
                        }`} style={
                          app.status === 'Pending' ? { backgroundColor: '#fef3c7', color: '#92400e' } : 
                          app.status === 'Rejected' ? { backgroundColor: '#fee2e2', color: '#991b1b' } : {}
                        }>
                          {app.status}
                        </span>
                      </td>
                      <td>
                        {isDoctor ? (
                          // Doctor View Action Controls
                          app.status === 'Pending' ? (
                            app.doctorName === doctorDisplayName ? (
                              <div style={{ display: 'flex', gap: '0.5rem' }}>
                                <button 
                                  onClick={() => handleUpdateStatus(app.id, 'Confirmed')}
                                  style={{ padding: '0.25rem 0.5rem', backgroundColor: '#10b981', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600 }}
                                >
                                  Approve
                                </button>
                                <button 
                                  onClick={() => handleUpdateStatus(app.id, 'Rejected')}
                                  style={{ padding: '0.25rem 0.5rem', backgroundColor: '#ef4444', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600 }}
                                >
                                  Reject
                                </button>
                              </div>
                            ) : (
                              <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>Assigned to {app.doctorName}</span>
                            )
                          ) : (
                            <span style={{ fontSize: '0.75rem', color: '#9ca3af', fontStyle: 'italic' }}>Processed</span>
                          )
                        ) : (
                          // Patient View Action Controls
                          <span style={{ fontSize: '0.75rem', color: '#4b5563' }}>
                            {app.status === 'Pending' ? `Waiting for ${app.doctorName}...` : `Decision Recorded`}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            
            {/* Show update message for doctors */}
            {isDoctor && message && <p style={{ fontSize: '0.875rem', marginTop: '1rem', color: '#047857' }}>{message}</p>}
          </div>
        </div>

        {/* Billing & Invoices Section (Patients Only) */}
        {!isDoctor && (
          <div className="card" style={{ marginTop: '2rem' }}>
            <h3 style={{ margin: '0 0 1.5rem', color: 'var(--primary-color)' }}>💳 My Billing & Invoices</h3>
            {invoices.length === 0 ? (
              <p style={{ color: '#6b7280', margin: 0 }}>No invoices generated yet. Book an appointment to trigger your first invoice.</p>
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th>Invoice ID</th>
                    <th>Patient Name</th>
                    <th>Date</th>
                    <th>Amount</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((inv) => (
                    <tr key={inv.invoiceId}>
                      <td><strong>{inv.invoiceId}</strong></td>
                      <td>{inv.patientName}</td>
                      <td>{inv.date}</td>
                      <td><strong>${inv.amount.toFixed(2)}</strong></td>
                      <td>
                        <span className={`badge ${inv.status === 'Paid' ? 'badge-success' : 'badge-danger'}`}
                              style={inv.status === 'Paid' ? {} : { backgroundColor: '#fee2e2', color: '#991b1b' }}>
                          {inv.status}
                        </span>
                      </td>
                      <td>
                        {inv.status === 'Unpaid' ? (
                          <button 
                            onClick={() => handlePayInvoice(inv.invoiceId)}
                            style={{ padding: '0.25rem 0.5rem', backgroundColor: '#3b82f6', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600 }}
                          >
                            Pay Now
                          </button>
                        ) : (
                          <span style={{ fontSize: '0.75rem', color: '#9ca3af', fontStyle: 'italic' }}>Settled</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

      </div>
    </div>
  )
}

export default App
