import { POST_TOKEN_ENDPOINT } from '@/utils/config';
import { redirect } from 'next/navigation';
import { headers, cookies } from 'next/headers';
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

const CallbackPage = async ({searchParams}) => {
  const code = (await searchParams).code;
  const expires_in = await getTokenExpiration(code)
  return (
    <div>
      <ClientComponent token_expires_in={expires_in}/>
    </div>
  )

}

export default CallbackPage;