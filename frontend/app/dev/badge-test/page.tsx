/**
 * Badge Test Page for debugging badge display issues
 */
"use client";

import { BadgeCollection } from "@/components/student/badge-collection";

export default function BadgeTestPage() {
  return (
    <div className="container mx-auto p-6 space-y-6">
      <h1 className="text-3xl font-bold">Badge System Test Page</h1>

      {/* Actual Badge Collection Component */}
      <div>
        <h2 className="text-xl font-semibold mb-4">
          Badge Collection Component
        </h2>
        <BadgeCollection />
      </div>
    </div>
  );
}
