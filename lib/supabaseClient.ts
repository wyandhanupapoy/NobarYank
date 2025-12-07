//lib/supabaseClinet.ts
import { createClient, RealtimeChannel } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseKey);

export const subscribeToRoom = (roomId: string, onMessage: (msg: any) => void): RealtimeChannel => {
    const channel = supabase.channel(`room:${roomId}`);

    channel
        .on('broadcast', { event: 'signal' }, (payload) => {
            onMessage(payload.payload);
        })
        .subscribe((status) => {
            if (status === 'SUBSCRIBED') {
                console.log(`Connected to signaling channel: ${roomId}`);
            }
        });

    return channel;
};

export const sendSignal = async (channel: RealtimeChannel, message: any) => {
    await channel.send({
        type: 'broadcast',
        event: 'signal',
        payload: message,
    });
};