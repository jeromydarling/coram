import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Upload, FileText, UserPlus, Loader2 } from 'lucide-react';
import { parseCSV } from '@/lib/csv';
import { AttendeeManualAddForm } from './AttendeeManualAddForm';
import type { AttendeeImportRow } from '@/types/event-planner';

interface AttendeeImportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImport: (rows: AttendeeImportRow[]) => Promise<void>;
  isLoading?: boolean;
}

export function AttendeeImportModal({ open, onOpenChange, onImport, isLoading }: AttendeeImportModalProps) {
  const [tab, setTab] = useState('csv');
  const [pasteText, setPasteText] = useState('');
  const [parsedRows, setParsedRows] = useState<AttendeeImportRow[]>([]);
  const [manualRows, setManualRows] = useState<AttendeeImportRow[]>([]);
  
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    try {
      const result = await parseCSV(file);
      const rows: AttendeeImportRow[] = result.rows.map(row => ({
        raw_full_name: row['Name'] || row['name'] || row['Full Name'] || row['full_name'] || '',
        raw_org: row['Organization'] || row['Org'] || row['Company'] || row['organization'] || row['company'] || undefined,
        raw_title: row['Title'] || row['Job Title'] || row['Position'] || row['title'] || undefined,
        raw_email: row['Email'] || row['email'] || row['E-mail'] || undefined,
        raw_phone: row['Phone'] || row['phone'] || row['Mobile'] || row['Cell'] || undefined,
        linkedin_url: row['LinkedIn'] || row['linkedin'] || row['LinkedIn URL'] || undefined,
      })).filter(r => r.raw_full_name.trim());
      
      setParsedRows(rows);
    } catch (error) {
      console.error('CSV parse error:', error);
    }
  };
  
  const handlePaste = () => {
    if (!pasteText.trim()) return;
    
    const lines = pasteText.split('\n').filter(l => l.trim());
    const rows: AttendeeImportRow[] = lines.map(line => {
      // Try to parse common formats:
      // "Name - Organization" or "Name, Title, Organization" or just "Name"
      let name = '';
      let org = '';
      let title = '';
      
      if (line.includes(' - ')) {
        const parts = line.split(' - ');
        name = parts[0].trim();
        org = parts.slice(1).join(' - ').trim();
      } else if (line.includes(',')) {
        const parts = line.split(',').map(p => p.trim());
        name = parts[0];
        if (parts.length === 2) {
          org = parts[1];
        } else if (parts.length >= 3) {
          title = parts[1];
          org = parts.slice(2).join(', ');
        }
      } else {
        name = line.trim();
      }
      
      return {
        raw_full_name: name,
        raw_org: org || undefined,
        raw_title: title || undefined,
      };
    }).filter(r => r.raw_full_name);
    
    setParsedRows(rows);
  };
  
  const handleManualAdd = (attendee: AttendeeImportRow) => {
    setManualRows(prev => [...prev, attendee]);
  };
  
  const handleImport = async () => {
    const allRows = tab === 'manual' ? manualRows : parsedRows;
    if (allRows.length === 0) return;
    
    await onImport(allRows);
    
    // Reset state
    setParsedRows([]);
    setManualRows([]);
    setPasteText('');
    onOpenChange(false);
  };
  
  const currentRows = tab === 'manual' ? manualRows : parsedRows;
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Import Attendees</DialogTitle>
          <DialogDescription>
            Add attendees via CSV upload, paste list, or manual entry.
          </DialogDescription>
        </DialogHeader>
        
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="csv" className="gap-2">
              <Upload className="w-4 h-4" />
              CSV Upload
            </TabsTrigger>
            <TabsTrigger value="paste" className="gap-2">
              <FileText className="w-4 h-4" />
              Paste List
            </TabsTrigger>
            <TabsTrigger value="manual" className="gap-2">
              <UserPlus className="w-4 h-4" />
              Manual Add
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="csv" className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label>Upload CSV File</Label>
              <Input
                type="file"
                accept=".csv"
                onChange={handleFileUpload}
                className="cursor-pointer"
              />
              <p className="text-xs text-muted-foreground">
                Expected columns: Name, Organization, Title, Email, Phone, LinkedIn
              </p>
            </div>
          </TabsContent>
          
          <TabsContent value="paste" className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label>Paste Attendee List</Label>
              <Textarea
                value={pasteText}
                onChange={(e) => setPasteText(e.target.value)}
                placeholder="One per line:&#10;John Smith - ACME Corp&#10;Jane Doe, Director, Nonprofit Inc&#10;Bob Wilson"
                rows={6}
              />
              <Button 
                type="button" 
                variant="outline" 
                size="sm"
                onClick={handlePaste}
                disabled={!pasteText.trim()}
              >
                Parse List
              </Button>
            </div>
          </TabsContent>
          
          <TabsContent value="manual" className="pt-4">
            <AttendeeManualAddForm 
              onAdd={handleManualAdd}
              isLoading={isLoading}
            />
          </TabsContent>
        </Tabs>
        
        {/* Preview */}
        {currentRows.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Preview ({currentRows.length} attendees)</Label>
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => tab === 'manual' ? setManualRows([]) : setParsedRows([])}
              >
                Clear
              </Button>
            </div>
            <ScrollArea className="h-40 border rounded-md p-2">
              <div className="space-y-1">
                {currentRows.map((row, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm">
                    <span className="font-medium">{row.raw_full_name}</span>
                    {row.raw_org && <Badge variant="outline" className="text-xs">{row.raw_org}</Badge>}
                    {row.raw_title && <span className="text-muted-foreground text-xs">{row.raw_title}</span>}
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        )}
        
        <div className="flex justify-end gap-3 pt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleImport}
            disabled={currentRows.length === 0 || isLoading}
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Importing...
              </>
            ) : (
              `Import ${currentRows.length} Attendees`
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
