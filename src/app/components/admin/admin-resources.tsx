import { Link } from "react-router";
import { FileText, ExternalLink, BookOpen } from "lucide-react";
import { Card, CardContent } from "../ui/card";
import { Button } from "../ui/button";

export function AdminResources() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-800">Documents</h2>
        <p className="text-sm text-gray-500">Quick access to operational resources</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="border-none shadow-sm">
          <CardContent className="p-6 space-y-3">
            <div className="flex items-center gap-2 text-gray-900 font-semibold">
              <BookOpen size={18} className="text-[#E31E24]" />
              Website Documents
            </div>
            <p className="text-sm text-gray-600">Open the public documents page and review current published content.</p>
            <Link to="/documents">
              <Button variant="outline" className="w-full justify-between">
                Open /documents
                <ExternalLink size={14} />
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm">
          <CardContent className="p-6 space-y-3">
            <div className="flex items-center gap-2 text-gray-900 font-semibold">
              <FileText size={18} className="text-[#E31E24]" />
              vAMSYS Ops Portal
            </div>
            <p className="text-sm text-gray-600">Manage airline operational data directly in vAMSYS backoffice.</p>
            <a href="https://vamsys.io" target="_blank" rel="noreferrer">
              <Button variant="outline" className="w-full justify-between">
                Open vAMSYS
                <ExternalLink size={14} />
              </Button>
            </a>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
