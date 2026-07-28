import { useState } from 'react';
import { 
  DragDropContext, 
  Droppable, 
  Draggable, 
  DropResult 
} from '@hello-pangea/dnd';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { 
  GripVertical, 
  Plus, 
  X, 
  Save, 
  BarChart3, 
  Table2, 
  TrendingUp, 
  Sparkles,
  FileText
} from 'lucide-react';
import { REPORT_SECTIONS, ReportSectionId, ReportTemplate } from '@/hooks/useReportTemplates';
import { cn } from '@/lib/utils';

interface ReportBuilderProps {
  template?: ReportTemplate;
  onSave: (template: Omit<ReportTemplate, 'id' | 'created_at' | 'updated_at' | 'created_by'>) => void;
  onCancel: () => void;
}

const sectionTypeIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  kpi: TrendingUp,
  table: Table2,
  chart: BarChart3,
  highlight: Sparkles,
};

export function ReportBuilder({ template, onSave, onCancel }: ReportBuilderProps) {
  const [name, setName] = useState(template?.name || '');
  const [description, setDescription] = useState(template?.description || '');
  const [selectedSections, setSelectedSections] = useState<string[]>(
    template?.sections || ['kpi_overview', 'pipeline_stage', 'recent_wins']
  );

  const availableSections = REPORT_SECTIONS.filter(
    section => !selectedSections.includes(section.id)
  );

  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) return;

    const items = Array.from(selectedSections);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);

    setSelectedSections(items);
  };

  const addSection = (sectionId: string) => {
    setSelectedSections([...selectedSections, sectionId]);
  };

  const removeSection = (sectionId: string) => {
    setSelectedSections(selectedSections.filter(id => id !== sectionId));
  };

  const handleSave = () => {
    if (!name.trim()) return;
    
    onSave({
      name: name.trim(),
      description: description.trim() || null,
      report_type: 'custom',
      sections: selectedSections,
      filters: {},
      is_default: false,
    });
  };

  const getSectionById = (id: string) => REPORT_SECTIONS.find(s => s.id === id);

  return (
    <div className="space-y-6">
      {/* Template Details */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Template Details
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="template-name">Template Name *</Label>
              <Input
                id="template-name"
                placeholder="e.g., Weekly Regional Update"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="template-description">Description</Label>
              <Input
                id="template-description"
                placeholder="Brief description of this report"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Selected Sections (Draggable) */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Report Sections</CardTitle>
            <CardDescription>
              Drag to reorder. These sections will appear in your report.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <DragDropContext onDragEnd={handleDragEnd}>
              <Droppable droppableId="selected-sections">
                {(provided) => (
                  <div
                    {...provided.droppableProps}
                    ref={provided.innerRef}
                    className="space-y-2 min-h-[200px]"
                  >
                    {selectedSections.length === 0 && (
                      <div className="text-center py-8 text-muted-foreground border-2 border-dashed rounded-lg">
                        <p>No sections selected</p>
                        <p className="text-sm">Add sections from the right panel</p>
                      </div>
                    )}
                    {selectedSections.map((sectionId, index) => {
                      const section = getSectionById(sectionId);
                      if (!section) return null;
                      const Icon = sectionTypeIcons[section.type] || FileText;
                      
                      return (
                        <Draggable key={sectionId} draggableId={sectionId} index={index}>
                          {(provided, snapshot) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              className={cn(
                                'flex items-center gap-3 p-3 bg-card border rounded-lg',
                                snapshot.isDragging && 'shadow-lg ring-2 ring-primary'
                              )}
                            >
                              <div
                                {...provided.dragHandleProps}
                                className="cursor-grab hover:bg-muted rounded p-1"
                              >
                                <GripVertical className="w-4 h-4 text-muted-foreground" />
                              </div>
                              <Icon className="w-4 h-4 text-primary" />
                              <div className="flex-1">
                                <p className="font-medium text-sm">{section.name}</p>
                                <p className="text-xs text-muted-foreground">{section.description}</p>
                              </div>
                              <Badge variant="secondary" className="text-xs">
                                {section.type}
                              </Badge>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => removeSection(sectionId)}
                              >
                                <X className="w-4 h-4" />
                              </Button>
                            </div>
                          )}
                        </Draggable>
                      );
                    })}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </DragDropContext>
          </CardContent>
        </Card>

        {/* Available Sections */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Available Sections</CardTitle>
            <CardDescription>
              Click to add sections to your report
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {availableSections.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <p>All sections added</p>
                </div>
              )}
              {availableSections.map((section) => {
                const Icon = sectionTypeIcons[section.type] || FileText;
                return (
                  <div
                    key={section.id}
                    className="flex items-center gap-3 p-3 bg-muted/50 border rounded-lg hover:bg-muted cursor-pointer transition-colors"
                    onClick={() => addSection(section.id)}
                  >
                    <Icon className="w-4 h-4 text-muted-foreground" />
                    <div className="flex-1">
                      <p className="font-medium text-sm">{section.name}</p>
                      <p className="text-xs text-muted-foreground">{section.description}</p>
                    </div>
                    <Badge variant="outline" className="text-xs">
                      {section.type}
                    </Badge>
                    <Plus className="w-4 h-4 text-primary" />
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-3">
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button onClick={handleSave} disabled={!name.trim() || selectedSections.length === 0}>
          <Save className="w-4 h-4 mr-2" />
          Save Template
        </Button>
      </div>
    </div>
  );
}
