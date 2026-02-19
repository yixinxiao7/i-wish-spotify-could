import { POST_TOKEN_ENDPOINT } from '@/utils/config';
import ClientComponent from './ClientComponent';

const getTokenExpiration = async (code: string) => {

  const response = await fetch(POST_TOKEN_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ code }),
  });
  const data = await response.json();
  if (response.status != 200) return;
  return data.expires_in
}

const CallbackPage = async ({ searchParams }: { searchParams: Promise<{ code?: string; state?: string }> }) => {
  const params = await searchParams;
  const code = params.code;
  const state = params.state;
  const expires_in = await getTokenExpiration(code ?? '')
  return (
    <div>
      <ClientComponent token_expires_in={expires_in} state={state}/>
    </div>
  )

}

export default CallbackPage;