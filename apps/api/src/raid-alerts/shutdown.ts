export function stopApiOnSignals(stop: () => Promise<void>) {
  let stopping = false;
  for (const signal of ["SIGINT", "SIGTERM"] as const) {
    process.once(signal, () => {
      if (stopping) return;
      stopping = true;
      const deadline = setTimeout(() => process.exit(1), 10_000);
      void stop().then(
        () => {
          clearTimeout(deadline);
          process.exit(0);
        },
        () => {
          clearTimeout(deadline);
          process.exit(1);
        },
      );
    });
  }
}
