# Runbook: Diagnosing K8s CrashLoopBackOff (General Application Failures)

## Problem Details
* **Symptom**: Pod starts, crashes, and restarts repeatedly.
* **Status**: `CrashLoopBackOff`.
* **RCA**: The container process terminated with an error (exit code != 0) shortly after starting. Common causes: missing configuration variables, database connection timeouts, port binding conflicts, or file permission errors.

## Diagnostic Steps
1. **Check Logs**: Run `kubectl logs <pod-name> --previous` to inspect the logs of the crashed container.
2. **Describe Pod**: Run `kubectl describe pod <pod-name>` to check the exit code and events.
3. **Database Reachability**: Verify if the backend can resolve the DB endpoint (e.g. CoreDNS resolution failures or security group blocking ingress).

## Standard Fixes
1. **Missing Variables**: Inject missing env configuration variables from ConfigMaps/Secrets.
2. **Readiness/Liveness Probes**: Check if probes are failing because the application takes too long to start (Spring Boot). Fix: Increase `initialDelaySeconds` or `failureThreshold`.
3. **Connection Pooling**: Adjust DB connection limits to prevent connection exhaustion.
