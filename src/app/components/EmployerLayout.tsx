import { ReactNode } from "react";
import {
    LayoutDashboard,
    Briefcase,
    Users,
    CreditCard,
    Settings,
    LogOut
} from "lucide-react";
import { Button } from "@/app/components/ui/button";
import { useAuth } from "../context/AuthContext";
import { useEmployerProfile } from "../../hooks/useEmployerProfile";

interface EmployerLayoutProps {
    children: ReactNode;
}

export function EmployerLayout({ children }: EmployerLayoutProps) {
    const { user, signOut } = useAuth();
    const { profile } = useEmployerProfile();

    return (
        <div className="flex min-h-screen bg-gray-50">
            {/* Sidebar */}
            <aside className="w-64 bg-white border-r border-gray-200 flex flex-col">
                <div className="p-6 border-b">
                    <h2 className="text-xl font-bold text-gray-900">
                        {profile?.company_name ?? "Your Company"}
                    </h2>
                    <p className="text-sm text-gray-500">Employer Portal</p>
                </div>

                <nav className="flex-1 p-4 space-y-1">
                    <SidebarItem icon={LayoutDashboard} label="Dashboard" />
                    <SidebarItem icon={Briefcase} label="Jobs" />
                    <SidebarItem icon={Users} label="Candidates" />
                    <SidebarItem icon={CreditCard} label="Billing" />
                    <SidebarItem icon={Settings} label="Settings" />
                </nav>

                <div className="p-4 border-t">
                    <Button
                        variant="ghost"
                        className="w-full justify-start text-red-600"
                        onClick={signOut}
                    >
                        <LogOut className="w-4 h-4 mr-2" />
                        Sign out
                    </Button>
                </div>
            </aside>

            {/* Main content */}
            <main className="flex-1">{children}</main>
        </div>
    );
}

function SidebarItem({
    icon: Icon,
    label
}: {
    icon: any;
    label: string;
}) {
    return (
        <button className="flex items-center gap-3 px-3 py-2 rounded-lg text-gray-700 hover:bg-gray-100 w-full text-left">
            <Icon className="w-4 h-4" />
            <span>{label}</span>
        </button>
    );
}
