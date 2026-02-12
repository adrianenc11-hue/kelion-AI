// ═══ BOOKING SYSTEM — Sistem programări cu Supabase ═══
// Creare, verificare, anulare programări — persistența în DB

const { patchProcessEnv } = require('./get-secret');

const { createClient } = require('@supabase/supabase-js');

const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

function getSupabase() {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY;
    if (!url || !key) return null;
    return createClient(url, key);
}

exports.handler = async (event) => {
    if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
    if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'POST only' }) };

    try {
        await patchProcessEnv(); // Load vault secrets
        const body = JSON.parse(event.body || '{}');
        const supabase = getSupabase();

        switch (body.action) {
            case 'create':
                return respond(200, await createBooking(supabase, body));
            case 'check_availability':
                return respond(200, await checkAvailability(supabase, body));
            case 'cancel':
                return respond(200, await cancelBooking(supabase, body));
            case 'reschedule':
                return respond(200, await rescheduleBooking(supabase, body));
            case 'list':
                return respond(200, await listBookings(supabase, body));
            case 'generate_slots':
                return respond(200, generateSlots(body));
            case 'reminder':
                return respond(200, generateReminder(body));
            default:
                return respond(400, { error: 'Actions: create, check_availability, cancel, reschedule, list, generate_slots, reminder' });
        }
    } catch (err) {
        console.error('Booking error:', err);
        return respond(500, { error: err.message });
    }
};

function respond(code, data) {
    return { statusCode: code, headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify({ success: code === 200, ...data }) };
}

async function createBooking(supabase, { client_name, client_phone, client_email, service, provider, date, time, duration_minutes = 60, notes }) {
    const id = `BK-${Date.now().toString(36).toUpperCase()}`;
    const endTime = calculateEndTime(time || '10:00', duration_minutes);
    const booking = {
        id,
        status: 'confirmed',
        client_name: client_name || '[Client]',
        client_phone: client_phone || '',
        client_email: client_email || '',
        service: service || '[Serviciu]',
        provider: provider || '[Furnizor]',
        date: date || new Date().toISOString().split('T')[0],
        time: time || '10:00',
        duration_minutes,
        end_time: endTime,
        notes: notes || '',
        created_at: new Date().toISOString()
    };

    // Persist to Supabase if available
    if (supabase) {
        const { error } = await supabase.from('bookings').insert(booking);
        if (error) {
            console.error('Booking insert error:', error.message);
            // If table doesn't exist, still return the booking data
            if (error.code === '42P01') {
                booking.storage = '⚠️ Table "bookings" not found — run migration first';
            } else {
                return { error: 'Failed to save booking', details: error.message };
            }
        } else {
            booking.storage = '🟢 Saved to Supabase';
        }
    } else {
        booking.storage = '⚠️ Supabase not configured — booking not persisted';
    }

    booking.confirmation_message = `✅ Programare confirmată!\n\n📋 Serviciu: ${booking.service}\n👤 Client: ${booking.client_name}\n📅 Data: ${booking.date}\n🕐 Ora: ${booking.time} - ${endTime}\n👨‍⚕️ Furnizor: ${booking.provider}\n\n📌 ID programare: ${id}\nPentru anulare/reprogramare, menționează ID-ul.`;

    return booking;
}

async function checkAvailability(supabase, { date, provider, duration_minutes = 60, working_hours = { start: '09:00', end: '18:00' } }) {
    let existingBookings = [];

    // Fetch existing bookings from DB if available
    if (supabase && date) {
        const { data } = await supabase
            .from('bookings')
            .select('time, duration_minutes')
            .eq('date', date)
            .eq('status', 'confirmed');
        if (data) existingBookings = data;
    }

    const slots = [];
    const [startH, startM] = (working_hours.start || '09:00').split(':').map(Number);
    const [endH, endM] = (working_hours.end || '18:00').split(':').map(Number);
    const breakMinutes = 15;

    let currentMinutes = startH * 60 + startM;
    const endMinutes = endH * 60 + endM;

    while (currentMinutes + duration_minutes <= endMinutes) {
        const slotStart = minutesToTime(currentMinutes);
        const slotEnd = minutesToTime(currentMinutes + duration_minutes);

        const isBooked = existingBookings.some(b => {
            const bStart = timeToMinutes(b.time);
            const bEnd = bStart + (b.duration_minutes || 60);
            return currentMinutes < bEnd && currentMinutes + duration_minutes > bStart;
        });

        slots.push({ time: slotStart, end_time: slotEnd, available: !isBooked });
        currentMinutes += duration_minutes + breakMinutes;
    }

    return {
        date: date || 'N/A',
        provider: provider || 'N/A',
        total_slots: slots.length,
        available_slots: slots.filter(s => s.available).length,
        slots,
        source: supabase ? '🟢 Supabase (live)' : '⚠️ No DB — no conflict checking'
    };
}

async function cancelBooking(supabase, { booking_id, reason }) {
    if (supabase && booking_id) {
        const { error } = await supabase
            .from('bookings')
            .update({ status: 'cancelled', notes: reason || 'La cererea clientului' })
            .eq('id', booking_id);
        if (error) console.error('Cancel error:', error.message);
    }

    return {
        booking_id: booking_id || 'unknown',
        status: 'cancelled',
        reason: reason || 'La cererea clientului',
        cancelled_at: new Date().toISOString(),
        message: `❌ Programarea ${booking_id} a fost anulată.\nMotiv: ${reason || 'La cererea clientului'}`
    };
}

async function rescheduleBooking(supabase, { booking_id, new_date, new_time }) {
    if (supabase && booking_id) {
        const { error } = await supabase
            .from('bookings')
            .update({ date: new_date, time: new_time, status: 'rescheduled' })
            .eq('id', booking_id);
        if (error) console.error('Reschedule error:', error.message);
    }

    return {
        booking_id: booking_id || 'unknown',
        status: 'rescheduled',
        new_date, new_time,
        message: `🔄 Programarea ${booking_id} a fost reprogramată.\n📅 Noua dată: ${new_date}\n🕐 Noua oră: ${new_time}`
    };
}

async function listBookings(supabase, { date, provider, status = 'confirmed' }) {
    if (!supabase) {
        return { bookings: [], note: '⚠️ Supabase not configured — cannot list bookings' };
    }

    let query = supabase.from('bookings').select('*').order('date', { ascending: true }).order('time', { ascending: true });
    if (date) query = query.eq('date', date);
    if (provider) query = query.eq('provider', provider);
    if (status) query = query.eq('status', status);

    const { data, error } = await query.limit(100);
    if (error) return { bookings: [], error: error.message };

    return {
        bookings: data || [],
        total: (data || []).length,
        filters: { date, provider, status },
        source: '🟢 Supabase (live)'
    };
}

function generateSlots({ date, working_hours = { start: '09:00', end: '18:00' }, slot_duration = 30, break_between = 10, lunch = { start: '13:00', end: '14:00' } }) {
    const slots = [];
    const [startH, startM] = working_hours.start.split(':').map(Number);
    const [endH, endM] = working_hours.end.split(':').map(Number);
    const [lunchStartH, lunchStartM] = lunch.start.split(':').map(Number);
    const [lunchEndH, lunchEndM] = lunch.end.split(':').map(Number);

    let current = startH * 60 + startM;
    const end = endH * 60 + endM;
    const lunchStart = lunchStartH * 60 + lunchStartM;
    const lunchEnd = lunchEndH * 60 + lunchEndM;

    while (current + slot_duration <= end) {
        if (current >= lunchStart && current < lunchEnd) {
            current = lunchEnd;
            continue;
        }
        slots.push({
            start: minutesToTime(current),
            end: minutesToTime(current + slot_duration),
            type: 'available'
        });
        current += slot_duration + break_between;
    }

    return { date, total_slots: slots.length, slot_duration_min: slot_duration, slots };
}

function generateReminder({ client_name, service, date, time, provider, hours_before = 24 }) {
    return {
        type: 'reminder',
        send_at: `${hours_before}h before appointment`,
        message_sms: `Reminder: ${client_name}, ai programare "${service}" mâine la ${time}. Confirmare: reply DA. Anulare: reply NU.`,
        message_email: {
            subject: `Reminder programare - ${service} - ${date}`,
            body: `Bună ${client_name},\n\nÎți reamintim că ai o programare:\n📋 ${service}\n📅 ${date}\n🕐 ${time}\n👨‍⚕️ ${provider || ''}\n\nPentru confirmare sau reprogramare, răspunde la acest email.\n\nCu stimă,\nEchipa Kelion AI`
        }
    };
}

// Helpers
function calculateEndTime(time, duration) {
    const [h, m] = time.split(':').map(Number);
    return minutesToTime(h * 60 + m + duration);
}

function minutesToTime(minutes) {
    return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
}

function timeToMinutes(time) {
    const [h, m] = time.split(':').map(Number);
    return h * 60 + m;
}
