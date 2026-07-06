# Runbook: Diagnosing K8s OOMKilled (Exit Code 137)

## Problem Details
* **Symptom**: Pod status transitions to `CrashLoopBackOff` or `Failed`.
* **Last State Reason**: `OOMKilled` (Exit Code 137).
* **RCA**: The application process requested memory beyond the specified Kubernetes limits (`resources.limits.memory`), causing the Linux kernel out-of-memory killer to terminate the container.

## Standard Fixes
1. **JVM Configuration**: If it's a Java / Spring Boot application, verify JVM memory limit awareness. 
   - Fix: Pass `-XX:MaxRAMPercentage=75.0` as an environment variable to prevent Java Heap from growing beyond container boundaries.
2. **Increase K8s Resource Limits**: Check container specifications. If the app needs more memory to process jobs:
   - Fix: Modify the deployment manifest to increase `resources.limits.memory` (e.g. from `256Mi` to `512Mi` or `1Gi`).
3. **Application Memory Leaks**: Query APM dashboards to identify memory consumption over time.
