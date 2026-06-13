import Link from 'next/link';
import { Heading } from './components';

export function StubPage({ title, parent, parentHref }: { title: string; parent: string; parentHref: string }) {
  return (
    <article>
      <Heading level={1}>{title}</Heading>
      <p className="text-sm text-gray-400 mb-6">
        This page is part of the{' '}
        <Link href={parentHref} className="text-orange-400 hover:underline">{parent}</Link>{' '}
        documentation. The full content for this section is available on the parent page.
      </p>
      <Link
        href={parentHref}
        className="inline-flex items-center gap-2 px-4 py-2 bg-orange-600 hover:bg-orange-500 text-white text-sm font-medium rounded-lg transition-colors"
      >
        View {parent} docs
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
        </svg>
      </Link>
    </article>
  );
}
