"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

export default function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  const navItems = [
    { href: "/dashboard", label: "Dashboard", icon: "📊" },
    { href: "/routers", label: "Routers", icon: "📡" },
    { href: "/incidents", label: "Incidents", icon: "⚠️" },
    { href: "/shift-notes", label: "Shift Notes", icon: "📝" },
    { href: "/usage", label: "Usage Reports", icon: "📈" },
  ];

  return (
    <aside className={`bg-gray-900 text-white transition-all duration-300 ${collapsed ? "w-16" : "w-64"} flex flex-col`}>
      {/* Header */}
      <div className="p-4 border-b border-gray-700">
        <div className="flex items-center justify-between">
          {!collapsed && (
            <div>
              <h1 className="text-lg font-bold">MylesNet</h1>
              <p className="text-xs text-gray-400">Network Operations</p>
            </div>
          )}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="p-2 hover:bg-gray-700 rounded-md transition-colors"
          >
            {collapsed ? "→" : "←"}
          </button>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-2">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center space-x-3 px-3 py-2 rounded-md transition-colors ${
                isActive
                  ? "bg-orange-600 text-white"
                  : "text-gray-300 hover:bg-gray-700"
              }`}
            >
              <span className="text-xl">{item.icon}</span>
              {!collapsed && <span>{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-gray-700">
        {!collapsed && (
          <div className="text-xs text-gray-400">
            <p>MylesCorp Technologies Ltd</p>
            <p>v1.0.0</p>
          </div>
        )}
      </div>
    </aside>
  );
}
