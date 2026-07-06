package com.careflow.appointments.controller;

import com.careflow.appointments.model.Appointment;
import com.careflow.appointments.repository.AppointmentRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.client.RestTemplate;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@RestController
@RequestMapping("/api/appointments")
public class AppointmentController {

    @Autowired
    private AppointmentRepository appointmentRepository;

    @Value("${notification.service.url}")
    private String notificationServiceUrl;

    @Value("${billing.service.url}")
    private String billingServiceUrl;

    private final RestTemplate restTemplate = new RestTemplate();

    @GetMapping("/health")
    public ResponseEntity<Map<String, String>> healthCheck() {
        Map<String, String> response = new HashMap<>();
        response.put("status", "healthy");
        return ResponseEntity.ok(response);
    }

    @GetMapping
    public ResponseEntity<List<Appointment>> getAllAppointments() {
        return ResponseEntity.ok(appointmentRepository.findAll());
    }

    @PostMapping
    public ResponseEntity<Appointment> createAppointment(@RequestBody Appointment appointment) {
        // Set default initial status to Pending
        if (appointment.getStatus() == null) {
            appointment.setStatus("Pending");
        }
        
        // 1. Save to Database
        Appointment savedAppointment = appointmentRepository.save(appointment);

        // 2. Trigger Internal Billing Service (Async-Safe REST Post)
        try {
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);

            Map<String, String> billingBody = new HashMap<>();
            billingBody.put("patientName", savedAppointment.getPatientName());

            HttpEntity<Map<String, String>> request = new HttpEntity<>(billingBody, headers);
            restTemplate.postForEntity(billingServiceUrl, request, String.class);
            System.out.println("[BILLING] Triggered mock invoice request for: " + savedAppointment.getPatientName());
        } catch (Exception e) {
            System.err.println("[BILLING ERROR] Failed to contact billing service: " + e.getMessage());
        }

        // 3. Trigger Internal Notification Service (Pending status alert)
        triggerNotification(savedAppointment);

        return ResponseEntity.ok(savedAppointment);
    }

    @PutMapping("/{id}/status")
    public ResponseEntity<?> updateAppointmentStatus(@PathVariable Long id, @RequestBody Map<String, String> payload) {
        String newStatus = payload.get("status");
        if (newStatus == null) {
            return ResponseEntity.badRequest().body(Map.of("detail", "Missing 'status' in request body"));
        }

        Optional<Appointment> appointmentOpt = appointmentRepository.findById(id);
        if (appointmentOpt.isEmpty()) {
            return ResponseEntity.notFound().build();
        }

        // 1. Update status in Database
        Appointment appointment = appointmentOpt.get();
        appointment.setStatus(newStatus);
        Appointment updatedAppointment = appointmentRepository.save(appointment);

        // 2. Trigger notification to patient about the status change
        triggerNotification(updatedAppointment);

        return ResponseEntity.ok(updatedAppointment);
    }

    private void triggerNotification(Appointment appointment) {
        try {
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);

            Map<String, String> requestBody = new HashMap<>();
            requestBody.put("patientName", appointment.getPatientName());
            requestBody.put("status", appointment.getStatus());
            requestBody.put("doctorName", appointment.getDoctorName());

            HttpEntity<Map<String, String>> request = new HttpEntity<>(requestBody, headers);
            restTemplate.postForEntity(notificationServiceUrl, request, String.class);
            System.out.println("[NOTIFICATION] Successfully triggered status alert (" + appointment.getStatus() + ") for: " + appointment.getPatientName());
        } catch (Exception e) {
            System.err.println("[NOTIFICATION ERROR] Failed to trigger internal notification: " + e.getMessage());
        }
    }
}
