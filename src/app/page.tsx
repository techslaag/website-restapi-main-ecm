export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-between p-24">
      <h1>Welcome to {process.env.NEXT_PUBLIC_APP_NAME} Rest API</h1>
      <h2>{process.env.NEXT_PUBLIC_APP_URL}</h2>
    </main>
  );
}


