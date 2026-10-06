import test from 'node:test';
import assert from 'node:assert/strict';
import { validateReportRisk, validateJournalEntry } from './lpJournal.js';

test('report risk retains exact counts and rejects hidden or malformed holds',()=>{
 const value={blocked:true,trusted_incident_count:'9007199254740993',ambiguous_incident_count:'1',reason_codes:['report_origin_unknown'],latest_incident_at:'2026-09-26T19:00:00Z'};
 assert.doesNotThrow(()=>validateReportRisk(value));
 assert.equal(value.trusted_incident_count,'9007199254740993');
 assert.doesNotThrow(()=>validateReportRisk(null));
 assert.doesNotThrow(()=>validateReportRisk({blocked:false,trusted_incident_count:'0',ambiguous_incident_count:'0',reason_codes:[],latest_incident_at:null}));
 for(const change of [{blocked:false},{trusted_incident_count:9007199254740992},{trusted_incident_count:'9223372036854775808'},{ambiguous_incident_count:'-1'},{reason_codes:['PRIVATE report text']},{reason_codes:['report_origin_unknown','report_origin_unknown']},{reason_codes:[]},{latest_incident_at:null},{latest_incident_at:'invalid'}])assert.throws(()=>validateReportRisk({...value,...change}));
 assert.throws(()=>validateJournalEntry({report_risk:{...value,blocked:false}}),/Report reconciliation/);
});
