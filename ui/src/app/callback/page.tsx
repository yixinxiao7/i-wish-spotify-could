import ClientComponent from './ClientComponent';

const CallbackPage = async ({ searchParams }: { searchParams: Promise<{ code?: string; state?: string; error?: string }> }) => {
  const params = await searchParams;
  return (
    <div>
      <ClientComponent code={params.code} state={params.state} error={params.error} />
    </div>
  )
}

export default CallbackPage;
