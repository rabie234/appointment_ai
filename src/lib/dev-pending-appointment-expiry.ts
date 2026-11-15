import { expirePendingAppointments } from "@/lib/pending-appointment-expiry";

const CHECK_INTERVAL_MS = 60_000;

type SchedulerGlobal = typeof globalThis & {
  __clinicAIPendingAppointmentExpiryTimer?: ReturnType<typeof setInterval>;
  __clinicAIPendingAppointmentExpiryRunning?: boolean;
};

const schedulerGlobal = globalThis as SchedulerGlobal;

async function runExpiryCheck() {
  if (schedulerGlobal.__clinicAIPendingAppointmentExpiryRunning) return;
  schedulerGlobal.__clinicAIPendingAppointmentExpiryRunning = true;

  try {
    const result = await expirePendingAppointments();
    if (result.cancelled > 0) {
      console.info("[ClinicAI dev scheduler] Expired pending appointments:", result);
    }
  } catch (error) {
    console.error("[ClinicAI dev scheduler] Expiry check failed:", error);
  } finally {
    schedulerGlobal.__clinicAIPendingAppointmentExpiryRunning = false;
  }
}

/** Start the local-only scheduler once per Node.js server process. */
export function startDevPendingAppointmentExpiryScheduler() {
  if (schedulerGlobal.__clinicAIPendingAppointmentExpiryTimer) return;

  void runExpiryCheck();

  const timer = setInterval(() => {
    void runExpiryCheck();
  }, CHECK_INTERVAL_MS);
  timer.unref();
  schedulerGlobal.__clinicAIPendingAppointmentExpiryTimer = timer;

  console.info(
    "[ClinicAI dev scheduler] Pending appointment expiry checks run every minute.",
  );
}
