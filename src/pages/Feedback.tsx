/**
 * Feedback (refactored) — "My help requests" page.
 *
 * WHAT: Shows the user's operator_intake submissions with status tracking.
 * WHERE: /:tenantSlug/feedback (avatar menu → "Help / Report something").
 * WHY: Users can track their submitted requests and see operator responses.
 */
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useOperatorIntake, IntakeStatus } from '@/hooks/useOperatorIntake';
import { IntakeForm } from '@/components/feedback/IntakeForm';
import { AlertTriangle, Sparkles, Clock, CheckCircle, XCircle, MessageSquare, ArrowRight } from 'lucide-react';
import { format } from 'date-fns';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useTranslation } from 'react-i18next';

export default function Feedback() {
  const { t } = useTranslation('common');
  const { myIntake, isLoadingMyIntake } = useOperatorIntake();

  const statusConfig: Record<IntakeStatus, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: React.ReactNode }> = {
    open: { label: t('feedback.statusOpen'), variant: 'secondary', icon: <Clock className="w-3 h-3" /> },
    triaged: { label: t('feedback.statusTriaged'), variant: 'default', icon: <ArrowRight className="w-3 h-3" /> },
    in_progress: { label: t('feedback.statusInProgress'), variant: 'default', icon: <ArrowRight className="w-3 h-3" /> },
    needs_more_info: { label: t('feedback.statusNeedsInfo'), variant: 'destructive', icon: <MessageSquare className="w-3 h-3" /> },
    resolved: { label: t('feedback.statusResolved'), variant: 'outline', icon: <CheckCircle className="w-3 h-3" /> },
    closed: { label: t('feedback.statusClosed'), variant: 'outline', icon: <XCircle className="w-3 h-3" /> },
  };

  const activeRequests = myIntake.filter((f) => !['resolved', 'closed'].includes(f.status));
  const closedRequests = myIntake.filter((f) => ['resolved', 'closed'].includes(f.status));

  const renderCard = (item: typeof myIntake[0]) => {
    const status = statusConfig[item.status as IntakeStatus] || statusConfig.open;

    return (
      <Card key={item.id} className="hover:shadow-md transition-shadow">
        <CardContent className="pt-4">
          <div className="flex items-start gap-3">
            {item.intake_type === 'problem' ? (
              <AlertTriangle className="w-5 h-5 text-destructive mt-0.5 flex-shrink-0" />
            ) : (
              <Sparkles className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
            )}
            <div className="flex-1 min-w-0">
              <h3 className="font-medium text-foreground">{item.title}</h3>
              <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap line-clamp-3">
                {item.body}
              </p>

              <div className="flex items-center gap-2 mt-3 flex-wrap">
                <Badge variant={status.variant} className="flex items-center gap-1">
                  {status.icon}
                  {status.label}
                </Badge>
                <Badge variant="outline" className="text-xs">
                  {item.intake_type === 'problem' ? t('feedback.typeProblem') : t('feedback.typeRequest')}
                </Badge>
                {item.module_key && (
                  <Badge variant="outline" className="text-xs text-muted-foreground">
                    {item.module_key}
                  </Badge>
                )}
                <span className="text-xs text-muted-foreground">
                  {format(new Date(item.created_at), 'MMM d, yyyy')}
                </span>
              </div>

              {item.operator_notes && (
                <div className="mt-3 p-2 bg-muted rounded-md">
                  <p className="text-xs font-medium text-muted-foreground">{t('feedback.operatorResponse')}</p>
                  <p className="text-sm text-foreground">{item.operator_notes}</p>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <MainLayout title={t('feedback.title')} subtitle={t('feedback.subtitle')} helpKey="page.feedback">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold">{t('feedback.yourRequests')}</h2>
            <p className="text-sm text-muted-foreground">
              {t('feedback.yourRequestsDesc')}
            </p>
          </div>
          <IntakeForm />
        </div>

        {/* Tabs */}
        <Tabs defaultValue="active" className="space-y-4">
          <TabsList>
            <TabsTrigger value="active" className="flex items-center gap-2">
              {t('feedback.tabActive')}
              {activeRequests.length > 0 && (
                <Badge variant="secondary" className="ml-1">{activeRequests.length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="closed" className="flex items-center gap-2">
              {t('feedback.tabClosed')}
              {closedRequests.length > 0 && (
                <Badge variant="outline" className="ml-1">{closedRequests.length}</Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="active" className="space-y-4">
            {isLoadingMyIntake ? (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">{t('feedback.loading')}</CardContent>
              </Card>
            ) : activeRequests.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center">
                  <p className="text-muted-foreground mb-4">{t('feedback.noActiveRequests')}</p>
                  <IntakeForm />
                </CardContent>
              </Card>
            ) : (
              activeRequests.map(renderCard)
            )}
          </TabsContent>

          <TabsContent value="closed" className="space-y-4">
            {closedRequests.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  {t('feedback.noClosedRequests')}
                </CardContent>
              </Card>
            ) : (
              closedRequests.map(renderCard)
            )}
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}
