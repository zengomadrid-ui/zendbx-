import { CodeBlock, Note, Heading } from '../components';

export const metadata = { title: 'Realtime — ZendBX Docs' };

const subscribe = `import { createClient } from '@zendbx/sdk';
const db = createClient({ apiUrl, anonKey, projectSlug });

// Subscribe to all changes on a table
const sub = db.realtime
  .from('messages')
  .on('*', (payload) => {
    console.log('Event:', payload.event);  // INSERT | UPDATE | DELETE
    console.log('New:', payload.new);
    console.log('Old:', payload.old);
  })
  .subscribe();

// Clean up
sub.unsubscribe();`;

const specificEvents = `// Listen only to inserts
const sub = db.realtime
  .from('orders')
  .on('INSERT', (payload) => {
    console.log('New order:', payload.new);
  })
  .subscribe();

// Listen only to updates
const sub2 = db.realtime
  .from('orders')
  .on('UPDATE', (payload) => {
    console.log('Order updated:', payload.new.status);
  })
  .subscribe();`;

const reactExample = `'use client';
import { useEffect, useState } from 'react';
import { db } from '@/lib/zendbx';

export default function LiveFeed() {
  const [messages, setMessages] = useState([]);

  useEffect(() => {
    const sub = db.realtime
      .from('messages')
      .on('INSERT', (payload) => {
        setMessages((prev) => [payload.new, ...prev]);
      })
      .subscribe();

    return () => sub.unsubscribe();
  }, []);

  return (
    <ul>
      {messages.map((m) => (
        <li key={m.id}>{m.text}</li>
      ))}
    </ul>
  );
}`;

export default function RealtimePage() {
  return (
    <article>
      <Heading level={1}>Realtime</Heading>
      <p className="text-sm text-gray-400 mb-8">
        ZendBX Realtime delivers live database changes over WebSocket.
        Subscribe to any table and receive <code className="text-orange-400">INSERT</code>, <code className="text-orange-400">UPDATE</code>,
        and <code className="text-orange-400">DELETE</code> events in real time.
      </p>

      <Heading level={2} id="how-it-works">How It Works</Heading>
      <p className="text-sm text-gray-400 mb-3">
        PostgreSQL LISTEN/NOTIFY triggers fire on table changes. The ZendBX realtime listener
        receives these events and broadcasts them to connected WebSocket clients that have
        subscribed to the relevant table.
      </p>

      <Heading level={2} id="subscribe">Subscribing</Heading>
      <CodeBlock code={subscribe} lang="typescript" />

      <Heading level={2} id="events">Specific Events</Heading>
      <CodeBlock code={specificEvents} lang="typescript" />

      <Heading level={2} id="react">React Example</Heading>
      <CodeBlock code={reactExample} lang="typescript" />

      <Note>
        Always call <code className="text-orange-400">sub.unsubscribe()</code> when the component unmounts to avoid memory leaks.
        In React, return it from the <code className="text-orange-400">useEffect</code> cleanup function.
      </Note>

      <Heading level={2} id="payload">Payload Structure</Heading>
      <CodeBlock code={`{
  event: 'INSERT' | 'UPDATE' | 'DELETE',
  table: 'messages',
  schema: 'my_project',
  new: { id: '...', text: 'Hello', ... },  // new row (null for DELETE)
  old: { id: '...', text: 'Hi', ... }      // old row (null for INSERT)
}`} lang="typescript" />

      <Heading level={2} id="auth">Authentication</Heading>
      <p className="text-sm text-gray-400 mb-3">
        The WebSocket connection sends the user's JWT token as a URL parameter during the initial handshake.
        Server-side RLS policies apply to realtime events — users only receive events for rows they're allowed to see.
      </p>

      <Heading level={2} id="reconnection">Auto-Reconnection</Heading>
      <p className="text-sm text-gray-400">
        The SDK automatically reconnects on network interruptions with exponential backoff.
        Subscriptions are re-established after reconnect.
      </p>
    </article>
  );
}
