type HealthResponse = {
  status?: string;
  sharedVersion?: string;
};

export default async function DebugPage() {
  const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:3000";
  let data: HealthResponse | null = null;
  let error: string | null = null;

  try {
    const res = await fetch(`${baseUrl}/health`, { cache: "no-store" });
    if (!res.ok) {
      throw new Error(`API status ${res.status}`);
    }
    data = (await res.json()) as HealthResponse;
  } catch (err) {
    error = err instanceof Error ? err.message : "Unknown error";
  }

  return (
    <main>
      <h1>Debug</h1>
      <p>API: {baseUrl}</p>
      {error ? <pre>{error}</pre> : <pre>{JSON.stringify(data, null, 2)}</pre>}
    </main>
  );
}
