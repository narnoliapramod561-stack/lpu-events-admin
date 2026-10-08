// supabase/functions/superadmin-operations/notifications/templates.ts
// Super Admin Operations Notifications Server-Side Templates (Phase 8)

export interface IncidentTemplateContext {
  incidentId: string;
  incidentKey: string;
  title: string;
  description: string;
  severity: 'CRITICAL' | 'HIGH' | 'WARNING' | 'INFO';
  serviceId: string;
  openedAt: string;
  durationString?: string;
  escalationLevel?: number;
  resolutionType?: string | null;
  resolutionReason?: string | null;
  resolvedBy?: string | null;
  resolvedAt?: string | null;
  dashboardUrl?: string;
}

export function renderNotificationTemplate(
  eventType: string,
  ctx: IncidentTemplateContext
): { subject: string; text: string; html: string } {
  const dashboard = ctx.dashboardUrl || 'https://admin.events.lpu.in';
  const prefix = ctx.severity === 'CRITICAL' ? '[CRITICAL ALERT]' : ctx.severity === 'HIGH' ? '[HIGH PRIORITY]' : '[OPERATIONS]';

  switch (eventType) {
    case 'INCIDENT_CREATED': {
      const subject = `${prefix} New Incident on ${ctx.serviceId}: ${ctx.title}`;
      const text = [
        `OPERATIONAL INCIDENT CREATED`,
        `============================`,
        `Incident ID: ${ctx.incidentId}`,
        `Service:     ${ctx.serviceId}`,
        `Severity:    ${ctx.severity}`,
        `Title:       ${ctx.title}`,
        `Opened At:   ${ctx.openedAt}`,
        ``,
        `Description:`,
        ctx.description,
        ``,
        `Control Center: ${dashboard}`,
      ].join('\n');

      const html = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2bfb0; border-radius: 8px;">
          <div style="background-color: ${ctx.severity === 'CRITICAL' ? '#fee2e2' : '#fef3c7'}; padding: 12px 16px; border-radius: 6px; border-left: 4px solid ${ctx.severity === 'CRITICAL' ? '#dc2626' : '#d97706'}; margin-bottom: 16px;">
            <strong style="color: ${ctx.severity === 'CRITICAL' ? '#991b1b' : '#92400e'}; font-size: 14px;">${prefix} Operational Incident Opened</strong>
          </div>
          <h2 style="margin: 0 0 12px 0; color: #261812; font-size: 18px;">${escapeHtml(ctx.title)}</h2>
          <table style="width: 100%; border-collapse: collapse; font-size: 13px; margin-bottom: 16px;">
            <tr><td style="padding: 6px 0; color: #5a4136; width: 120px;"><strong>Service:</strong></td><td style="color: #261812;">${escapeHtml(ctx.serviceId)}</td></tr>
            <tr><td style="padding: 6px 0; color: #5a4136;"><strong>Severity:</strong></td><td style="color: #261812; font-weight: bold;">${ctx.severity}</td></tr>
            <tr><td style="padding: 6px 0; color: #5a4136;"><strong>Opened At:</strong></td><td style="color: #261812;">${escapeHtml(ctx.openedAt)}</td></tr>
            <tr><td style="padding: 6px 0; color: #5a4136;"><strong>Incident ID:</strong></td><td style="color: #8e7164; font-family: monospace;">${escapeHtml(ctx.incidentId)}</td></tr>
          </table>
          <p style="font-size: 13px; color: #5a4136; line-height: 1.5; background: #fff8f6; padding: 12px; border-radius: 6px;">${escapeHtml(ctx.description)}</p>
          <div style="margin-top: 20px; text-align: center;">
            <a href="${dashboard}" style="display: inline-block; background-color: #ff6b00; color: #ffffff; text-decoration: none; padding: 10px 20px; border-radius: 6px; font-size: 13px; font-weight: bold;">View in Operations Control Center</a>
          </div>
        </div>
      `;
      return { subject, text, html };
    }

    case 'INCIDENT_ESCALATED': {
      const level = ctx.escalationLevel || 1;
      const subject = `[ESCALATION L${level}] Unresolved ${ctx.severity} on ${ctx.serviceId}: ${ctx.title}`;
      const text = [
        `OPERATIONAL INCIDENT ESCALATION (LEVEL ${level})`,
        `================================================`,
        `Incident ID: ${ctx.incidentId}`,
        `Service:     ${ctx.serviceId}`,
        `Severity:    ${ctx.severity}`,
        `Title:       ${ctx.title}`,
        `Duration:    ${ctx.durationString || 'Ongoing'}`,
        `Opened At:   ${ctx.openedAt}`,
        ``,
        `Attention: This incident remains unresolved beyond the configured escalation threshold.`,
        ``,
        `Control Center: ${dashboard}`,
      ].join('\n');

      const html = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #dc2626; border-radius: 8px;">
          <div style="background-color: #fee2e2; padding: 12px 16px; border-radius: 6px; border-left: 4px solid #dc2626; margin-bottom: 16px;">
            <strong style="color: #991b1b; font-size: 14px;">[ESCALATION LEVEL ${level}] Incident Remains Unresolved</strong>
          </div>
          <h2 style="margin: 0 0 12px 0; color: #261812; font-size: 18px;">${escapeHtml(ctx.title)}</h2>
          <p style="font-size: 13px; color: #991b1b; font-weight: bold;">This operational incident requires priority intervention.</p>
          <table style="width: 100%; border-collapse: collapse; font-size: 13px; margin-bottom: 16px;">
            <tr><td style="padding: 6px 0; color: #5a4136; width: 120px;"><strong>Service:</strong></td><td style="color: #261812;">${escapeHtml(ctx.serviceId)}</td></tr>
            <tr><td style="padding: 6px 0; color: #5a4136;"><strong>Severity:</strong></td><td style="color: #dc2626; font-weight: bold;">${ctx.severity}</td></tr>
            <tr><td style="padding: 6px 0; color: #5a4136;"><strong>Current Duration:</strong></td><td style="color: #261812;">${escapeHtml(ctx.durationString || 'Ongoing')}</td></tr>
            <tr><td style="padding: 6px 0; color: #5a4136;"><strong>Incident ID:</strong></td><td style="color: #8e7164; font-family: monospace;">${escapeHtml(ctx.incidentId)}</td></tr>
          </table>
          <div style="margin-top: 20px; text-align: center;">
            <a href="${dashboard}" style="display: inline-block; background-color: #dc2626; color: #ffffff; text-decoration: none; padding: 10px 20px; border-radius: 6px; font-size: 13px; font-weight: bold;">Acknowledge / Investigate in Control Center</a>
          </div>
        </div>
      `;
      return { subject, text, html };
    }

    case 'INCIDENT_RESOLVED': {
      const subject = `[RECOVERED] Incident on ${ctx.serviceId} Auto-Recovered: ${ctx.title}`;
      const text = [
        `OPERATIONAL INCIDENT AUTOMATIC RECOVERY`,
        `=======================================`,
        `Incident ID:        ${ctx.incidentId}`,
        `Service:            ${ctx.serviceId}`,
        `Resolution Type:    AUTO_RECOVERY`,
        `Title:              ${ctx.title}`,
        `Total Duration:     ${ctx.durationString || 'N/A'}`,
        `Resolved At:        ${ctx.resolvedAt || new Date().toISOString()}`,
        ``,
        `All contributing machine alerts have returned to nominal parameters.`,
        ``,
        `Control Center: ${dashboard}`,
      ].join('\n');

      const html = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #16a34a; border-radius: 8px;">
          <div style="background-color: #dcfce7; padding: 12px 16px; border-radius: 6px; border-left: 4px solid #16a34a; margin-bottom: 16px;">
            <strong style="color: #166534; font-size: 14px;">[AUTO RECOVERY] Operational Incident Resolved</strong>
          </div>
          <h2 style="margin: 0 0 12px 0; color: #261812; font-size: 18px;">${escapeHtml(ctx.title)}</h2>
          <p style="font-size: 13px; color: #166534;">Contributing telemetry conditions have cleared and returned to normal status.</p>
          <table style="width: 100%; border-collapse: collapse; font-size: 13px; margin-bottom: 16px;">
            <tr><td style="padding: 6px 0; color: #5a4136; width: 120px;"><strong>Service:</strong></td><td style="color: #261812;">${escapeHtml(ctx.serviceId)}</td></tr>
            <tr><td style="padding: 6px 0; color: #5a4136;"><strong>Provenance:</strong></td><td style="color: #16a34a; font-weight: bold;">AUTO_RECOVERY</td></tr>
            <tr><td style="padding: 6px 0; color: #5a4136;"><strong>Duration:</strong></td><td style="color: #261812;">${escapeHtml(ctx.durationString || 'N/A')}</td></tr>
          </table>
          <div style="margin-top: 20px; text-align: center;">
            <a href="${dashboard}" style="display: inline-block; background-color: #16a34a; color: #ffffff; text-decoration: none; padding: 10px 20px; border-radius: 6px; font-size: 13px; font-weight: bold;">View Incident Archive</a>
          </div>
        </div>
      `;
      return { subject, text, html };
    }

    case 'INCIDENT_MANUALLY_RESOLVED': {
      const subject = `[MANUALLY RESOLVED] Incident on ${ctx.serviceId} Resolved by Operator: ${ctx.title}`;
      const text = [
        `OPERATIONAL INCIDENT MANUALLY RESOLVED`,
        `======================================`,
        `Incident ID:        ${ctx.incidentId}`,
        `Service:            ${ctx.serviceId}`,
        `Resolution Type:    MANUAL`,
        `Resolved By:        ${ctx.resolvedBy || 'Super Admin'}`,
        `Resolved At:        ${ctx.resolvedAt || new Date().toISOString()}`,
        `Reason:             ${ctx.resolutionReason || 'No reason specified'}`,
        ``,
        `Control Center: ${dashboard}`,
      ].join('\n');

      const html = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #16a34a; border-radius: 8px;">
          <div style="background-color: #dcfce7; padding: 12px 16px; border-radius: 6px; border-left: 4px solid #16a34a; margin-bottom: 16px;">
            <strong style="color: #166534; font-size: 14px;">[MANUAL RESOLUTION] Incident Resolved by Super Admin</strong>
          </div>
          <h2 style="margin: 0 0 12px 0; color: #261812; font-size: 18px;">${escapeHtml(ctx.title)}</h2>
          <table style="width: 100%; border-collapse: collapse; font-size: 13px; margin-bottom: 16px;">
            <tr><td style="padding: 6px 0; color: #5a4136; width: 120px;"><strong>Service:</strong></td><td style="color: #261812;">${escapeHtml(ctx.serviceId)}</td></tr>
            <tr><td style="padding: 6px 0; color: #5a4136;"><strong>Provenance:</strong></td><td style="color: #16a34a; font-weight: bold;">MANUAL</td></tr>
            <tr><td style="padding: 6px 0; color: #5a4136;"><strong>Resolved By:</strong></td><td style="color: #261812; font-family: monospace;">${escapeHtml(ctx.resolvedBy || 'Super Admin')}</td></tr>
            <tr><td style="padding: 6px 0; color: #5a4136;"><strong>Reason:</strong></td><td style="color: #261812;">${escapeHtml(ctx.resolutionReason || 'Mitigated')}</td></tr>
          </table>
          <div style="margin-top: 20px; text-align: center;">
            <a href="${dashboard}" style="display: inline-block; background-color: #16a34a; color: #ffffff; text-decoration: none; padding: 10px 20px; border-radius: 6px; font-size: 13px; font-weight: bold;">View Incident Archive</a>
          </div>
        </div>
      `;
      return { subject, text, html };
    }

    default: {
      const subject = `[OPERATIONS NOTICE] ${ctx.serviceId}: ${ctx.title}`;
      const text = `OPERATIONS NOTICE\nService: ${ctx.serviceId}\nTitle: ${ctx.title}\nDetails: ${ctx.description}\nControl Center: ${dashboard}`;
      const html = `<p><strong>Operations Notice:</strong> ${escapeHtml(ctx.title)}</p>`;
      return { subject, text, html };
    }
  }
}

function escapeHtml(str: string): string {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
