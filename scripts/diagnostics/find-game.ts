import 'dotenv/config';
import { createServiceClient } from '@/lib/shared/supabase';

async function main() {
  const supabase = createServiceClient();
  const { data, error } = await supabase.from('games').select('*').ilike('name', '%hegemon%');
  console.log(error, JSON.stringify(data, null, 2));
}
main();
