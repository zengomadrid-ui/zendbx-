"use client";


import { useState } from "react";
import Link from "next/link";

export default function DatabasePage() {
  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Database Management</h1>
        <p className="text-gray-600">Manage your database schema, tables, functions, and triggers</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Link href="/dashboard/database/tables">
          <div className="p-6 border rounded-lg hover:shadow-lg transition cursor-pointer">
            <h3 className="text-xl font-semibold mb-2">Tables</h3>
            <p className="text-gray-600">Create and manage database tables</p>
          </div>
        </Link>

        <Link href="/dashboard/database/schema">
          <div className="p-6 border rounded-lg hover:shadow-lg transition cursor-pointer">
            <div className="text-4xl mb-4">🔗</div>
            <h3 className="text-xl font-semibold mb-2">Schema Visualizer</h3>
            <p className="text-gray-600">Visualize table relationships</p>
          </div>
        </Link>

        <Link href="/dashboard/database/functions">
          <div className="p-6 border rounded-lg hover:shadow-lg transition cursor-pointer">
            <h3 className="text-xl font-semibold mb-2">Functions</h3>
            <p className="text-gray-600">Manage stored procedures</p>
          </div>
        </Link>

        <Link href="/dashboard/database/triggers">
          <div className="p-6 border rounded-lg hover:shadow-lg transition cursor-pointer">
            <h3 className="text-xl font-semibold mb-2">Triggers</h3>
            <p className="text-gray-600">Automate database actions</p>
          </div>
        </Link>
      </div>
    </div>
  );
}
