import React from 'react';
import { History, FileText, FlaskConical, Shield, Calendar, UserCheck } from 'lucide-react';
import { doctorApi } from '../services/doctorApi';

const EMPTY_VALUE = '— Not available yet —';

function valueOrBlank(value) {
  if (Array.isArray(value)) return value.length ? value.join(', ') : EMPTY_VALUE;
  return value === undefined || value === null || String(value).trim() === '' ? EMPTY_VALUE : value;
}

function IntakeField({ label, value }) {
  return (
    <div>
      <div style={{ fontSize: '0.68rem', fontWeight: 800, color: 'var(--slate-500)', textTransform: 'uppercase', marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: '0.82rem', fontWeight: 650, color: valueOrBlank(value) === EMPTY_VALUE ? 'var(--slate-400)' : 'var(--navy-900)' }}>{valueOrBlank(value)}</div>
    </div>
  );
}

export const RevisitingHistorySection = ({ priorNotes = [], priorIntakes = [], publishedReports = [], doctorName = 'Dr. Ramesh Mehta', encounterId }) => {
  const downloadOriginal = async (report) => {
    try {
      const blob = await doctorApi.downloadOriginalReport(encounterId, report.id || report._id);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = report.original_file_name || `report-${report.id || report._id}.pdf`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      window.alert(error.message || 'Original report is unavailable.');
    }
  };
  return (
    <div id="doctor-reports" style={{ marginBottom: 28 }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 16,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--navy-900)' }}>
            Revisiting Bounded Records (Unlocked by Patient)
          </h3>
          <span className="badge badge-revisiting">
            REVISITING ACCESS
          </span>
        </div>

        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          fontSize: '0.76rem',
          color: '#059669',
          fontWeight: 600,
          backgroundColor: '#ecfdf5',
          padding: '4px 10px',
          borderRadius: 20,
          border: '1px solid #a7f3d0',
        }}>
          <Shield size={13} />
          <span>Patient Granted Bounded Historical Access</span>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        {/* 1. Prior Consultation Notes (Author: THIS Doctor ONLY) */}
        <div className="v-card">
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 12,
            paddingBottom: 8,
            borderBottom: '1px solid var(--border-subtle)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <History size={18} color="var(--blue-600)" />
              <span style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--navy-900)' }}>
                Your Previous Consultation Notes
              </span>
            </div>
            <span style={{ fontSize: '0.72rem', color: 'var(--slate-500)', fontWeight: 600 }}>
              {priorNotes.length} note{priorNotes.length === 1 ? '' : 's'} found
            </span>
          </div>

          <div style={{
            fontSize: '0.76rem',
            color: 'var(--slate-500)',
            marginBottom: 12,
            backgroundColor: '#f8fafc',
            padding: '6px 10px',
            borderRadius: 6,
          }}>
            <UserCheck size={13} style={{ display: 'inline', marginRight: 4, verticalAlign: -2 }} />
            Exclusively authored by {doctorName}. Notes by other doctors are strictly sealed.
          </div>

          {priorNotes.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {priorNotes.map((note, idx) => (
                <div
                  key={note._id || idx}
                  style={{
                    padding: 12,
                    borderRadius: 8,
                    backgroundColor: '#f8fafc',
                    border: '1px solid var(--slate-200)',
                  }}
                >
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    fontSize: '0.74rem',
                    color: 'var(--slate-500)',
                    marginBottom: 6,
                  }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Calendar size={12} />
                      {new Date(note.created_at).toLocaleDateString(undefined, {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </span>
                    <span style={{
                      fontWeight: 700,
                      color: 'var(--blue-700)',
                      backgroundColor: 'var(--blue-50)',
                      padding: '1px 6px',
                      borderRadius: 4,
                    }}>
                      DOCTOR_ENTERED
                    </span>
                  </div>
                  <p style={{ fontSize: '0.88rem', color: 'var(--navy-900)', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>
                    {note.notes_text}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ padding: '20px 0', textAlign: 'center', color: 'var(--slate-500)', fontSize: '0.84rem' }}>
              No prior notes authored by you for this patient.
            </div>
          )}
        </div>

        {/* 2. All Published Diagnostic Reports */}
        <div className="v-card">
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 12,
            paddingBottom: 8,
            borderBottom: '1px solid var(--border-subtle)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <FlaskConical size={18} color="var(--teal-600)" />
              <span style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--navy-900)' }}>
                Published Diagnostic Reports (All Labs)
              </span>
            </div>
            <span style={{ fontSize: '0.72rem', color: 'var(--slate-500)', fontWeight: 600 }}>
              {publishedReports.length} report{publishedReports.length === 1 ? '' : 's'}
            </span>
          </div>

          <div style={{
            fontSize: '0.76rem',
            color: 'var(--slate-500)',
            marginBottom: 12,
            backgroundColor: '#f8fafc',
            padding: '6px 10px',
            borderRadius: 6,
          }}>
            Cross-laboratory diagnostic visibility permitted under REVISITING consultation.
          </div>

          {publishedReports.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {publishedReports.map((rep, idx) => (
                <div
                  key={rep.id || rep._id || idx}
                  style={{
                    padding: 14,
                    borderRadius: 10,
                    backgroundColor: '#ffffff',
                    border: '1px solid var(--slate-200)',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                    <div>
                      <div style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--navy-900)' }}>
                        {rep.test_type || 'Complete Blood Count (CBC)'}
                      </div>
                      <div style={{ fontSize: '0.76rem', color: 'var(--slate-500)' }}>
                        {rep.laboratory_name || '— Not available yet —'} ({rep.laboratory_code || '— Not available yet —'}) • {rep.published_at ? new Date(rep.published_at).toLocaleDateString() : '— Not available yet —'}
                      </div>
                    </div>
                    <span style={{
                      backgroundColor: '#ecfdf5',
                      color: '#059669',
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      padding: '2px 8px',
                      borderRadius: 10,
                      border: '1px solid #a7f3d0',
                    }}>
                      PUBLISHED
                    </span>
                  </div>

                  <button type="button" className="btn-secondary" onClick={() => downloadOriginal(rep)} style={{ marginTop: 8, padding: '6px 10px', fontSize: '0.74rem' }}>
                    <FileText size={14} /> View original PDF
                  </button>

                  {/* Observations Table Preview */}
                  {rep.observations && rep.observations.length > 0 && (
                    <div style={{ marginTop: 8, borderTop: '1px solid var(--slate-100)', paddingTop: 8 }}>
                      <table style={{ width: '100%', fontSize: '0.76rem', borderCollapse: 'collapse' }}>
                        <thead>
                          <tr style={{ color: 'var(--slate-400)', textAlign: 'left', borderBottom: '1px solid var(--slate-100)' }}>
                            <th style={{ paddingBottom: 4 }}>Parameter</th>
                            <th style={{ paddingBottom: 4 }}>Value</th>
                            <th style={{ paddingBottom: 4 }}>Ref Range</th>
                            <th style={{ paddingBottom: 4 }}>Flag</th>
                          </tr>
                        </thead>
                        <tbody>
                          {rep.observations.slice(0, 5).map((obs, oIdx) => (
                            <tr key={oIdx} style={{ borderBottom: '1px solid #f8fafc' }}>
                              <td style={{ padding: '4px 0', fontWeight: 600, color: 'var(--slate-700)' }}>
                                {obs.test_name_normalized || obs.test_name_original}
                              </td>
                              <td style={{ padding: '4px 0', fontWeight: 700, color: obs.flag === 'LOW' ? '#1d4ed8' : (obs.flag === 'HIGH' ? '#dc2626' : '#059669') }}>
                                {obs.value} {obs.unit}
                              </td>
                              <td style={{ padding: '4px 0', color: 'var(--slate-500)' }}>
                                {obs.reference_low} - {obs.reference_high} {obs.unit}
                              </td>
                              <td style={{ padding: '4px 0' }}>
                                <span style={{
                                  fontSize: '0.68rem',
                                  fontWeight: 700,
                                  padding: '1px 6px',
                                  borderRadius: 4,
                                  backgroundColor: obs.flag === 'LOW' ? '#eff6ff' : (obs.flag === 'HIGH' ? '#fef2f2' : '#ecfdf5'),
                                  color: obs.flag === 'LOW' ? '#1d4ed8' : (obs.flag === 'HIGH' ? '#dc2626' : '#059669'),
                                }}>
                                  {obs.flag}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div style={{ padding: '20px 0', textAlign: 'center', color: 'var(--slate-500)', fontSize: '0.84rem' }}>
              No published reports found for this patient.
            </div>
          )}
        </div>
      </div>

      {/* 3. Previous structured clinical intake, limited to this doctor's encounters */}
      <div className="v-card" style={{ marginTop: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, paddingBottom: 8, borderBottom: '1px solid var(--border-subtle)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <History size={18} color="var(--teal-600)" />
            <span style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--navy-900)' }}>Previous Clinical Intake</span>
          </div>
          <span style={{ fontSize: '0.72rem', color: 'var(--slate-500)', fontWeight: 600 }}>
            {priorIntakes.length} previous session{priorIntakes.length === 1 ? '' : 's'}
          </span>
        </div>
        <div style={{ fontSize: '0.76rem', color: 'var(--slate-500)', marginBottom: 12, backgroundColor: '#f8fafc', padding: '6px 10px', borderRadius: 6 }}>
          Structured intake from previous consultations with {doctorName}. Missing extraction fields are intentionally blank for now.
        </div>
        {priorIntakes.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {priorIntakes.map((item, index) => {
              const intake = item.intake || {};
              return (
                <div key={item.encounter_id || index} style={{ padding: 14, borderRadius: 10, backgroundColor: '#f8fafc', border: '1px solid var(--slate-200)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, fontSize: '0.74rem', color: 'var(--slate-500)' }}>
                    <span>{item.created_at ? new Date(item.created_at).toLocaleString() : EMPTY_VALUE}</span>
                    <span style={{ fontWeight: 800, color: 'var(--blue-700)', backgroundColor: 'var(--blue-50)', padding: '2px 7px', borderRadius: 4 }}>{item.visit_type || 'CONSULTATION'}</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 14 }}>
                    <IntakeField label="Original language" value={intake.language} />
                    <IntakeField label="Chief complaint" value={intake.chief_complaint} />
                    <IntakeField label="Duration" value={intake.duration} />
                    <IntakeField label="Possible category" value={intake.possible_symptom_categories} />
                    <IntakeField label="Symptoms" value={intake.symptoms} />
                    <IntakeField label="Allergies" value={intake.allergies} />
                    <IntakeField label="Input mode" value={intake.input_mode ? String(intake.input_mode).toUpperCase() : ''} />
                    <IntakeField label="Session created" value={intake.session_created_at ? new Date(intake.session_created_at).toLocaleString() : item.created_at ? new Date(item.created_at).toLocaleString() : ''} />
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div style={{ padding: '20px 0', textAlign: 'center', color: 'var(--slate-400)', fontSize: '0.84rem' }}>{EMPTY_VALUE}</div>
        )}
      </div>
    </div>
  );
};
