// Runs once when the server starts (see startShellServer in server/control.ts).
export async function register() {
  if (process.env['NEXT_RUNTIME'] === 'nodejs') {
    const { startShellServer } = await import('./server/control.ts');
    startShellServer();
  }
}
