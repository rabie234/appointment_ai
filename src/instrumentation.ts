export async function register() {
  if (
    process.env.NODE_ENV !== "development" ||
    process.env.NEXT_RUNTIME !== "nodejs"
  ) {
    return;
  }

  const { startDevPendingAppointmentExpiryScheduler } = await import(
    "@/lib/dev-pending-appointment-expiry"
  );
  startDevPendingAppointmentExpiryScheduler();
}
