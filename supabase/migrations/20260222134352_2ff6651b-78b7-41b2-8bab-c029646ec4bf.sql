-- Remove deleted operator/nexus/lens test suites and their associated data.
-- First delete steps, then runs, then suites to respect FK constraints.

-- Delete steps for runs referencing deleted suites
DELETE FROM qa_test_run_steps WHERE run_id IN (
  SELECT id FROM qa_test_runs WHERE suite_key IN (
    '09_operator_console_admin_loads',
    '10_demo_lab_admin_loads',
    '38_lens_shepherd_nav',
    '39_lens_companion_restricted',
    '40_lens_visitor_redirects',
    '41_full_workspace_toggle',
    '41_visitor_lens_toggle',
    '58_operator_signum_dashboard',
    '59_praeceptum_memory_update',
    '60_praeceptum_adaptive_prompt_order',
    '61_operator_guidance_dashboard',
    '62_lumen_signal_detection',
    '63_operator_lumen_dashboard',
    '64_assistchip_lumen_prompt',
    '66_operator_partners_list',
    '67_operator_scheduling',
    '68_operator_outreach',
    '69_operator_activation',
    '70_operator_error_desk',
    '71_operator_qa_page',
    '72_operator_manuals',
    '73_operator_time_machine',
    '74_operator_announcements',
    '75_operator_ecosystem',
    '76_operator_overrides',
    '77_nexus_home',
    '78_nexus_playbooks',
    '79_nexus_support_inbox',
    '80_nexus_activation_manager',
    '81_nexus_expansion',
    '82_nexus_knowledge',
    '83_nexus_rhythm',
    '84_nexus_presence',
    '85_nexus_arrival',
    '86_nexus_recovery',
    '87_nexus_narrative',
    '88_nexus_narrative_studio',
    '89_nexus_civitas_studio',
    '90_nexus_adoption',
    '91_nexus_stability',
    '92_nexus_narrative_ecosystem',
    '93_guided_activation_prep'
  )
);

-- Delete fix prompts for those runs
DELETE FROM qa_fix_prompts WHERE run_id IN (
  SELECT id FROM qa_test_runs WHERE suite_key IN (
    '09_operator_console_admin_loads','10_demo_lab_admin_loads',
    '38_lens_shepherd_nav','39_lens_companion_restricted','40_lens_visitor_redirects',
    '41_full_workspace_toggle','41_visitor_lens_toggle',
    '58_operator_signum_dashboard','59_praeceptum_memory_update',
    '60_praeceptum_adaptive_prompt_order','61_operator_guidance_dashboard',
    '62_lumen_signal_detection','63_operator_lumen_dashboard','64_assistchip_lumen_prompt',
    '66_operator_partners_list','67_operator_scheduling','68_operator_outreach',
    '69_operator_activation','70_operator_error_desk','71_operator_qa_page',
    '72_operator_manuals','73_operator_time_machine','74_operator_announcements',
    '75_operator_ecosystem','76_operator_overrides','77_nexus_home','78_nexus_playbooks',
    '79_nexus_support_inbox','80_nexus_activation_manager','81_nexus_expansion',
    '82_nexus_knowledge','83_nexus_rhythm','84_nexus_presence','85_nexus_arrival',
    '86_nexus_recovery','87_nexus_narrative','88_nexus_narrative_studio',
    '89_nexus_civitas_studio','90_nexus_adoption','91_nexus_stability',
    '92_nexus_narrative_ecosystem','93_guided_activation_prep'
  )
);

-- Delete run failures for those runs
DELETE FROM qa_run_failures WHERE run_id IN (
  SELECT id FROM qa_test_runs WHERE suite_key IN (
    '09_operator_console_admin_loads','10_demo_lab_admin_loads',
    '38_lens_shepherd_nav','39_lens_companion_restricted','40_lens_visitor_redirects',
    '41_full_workspace_toggle','41_visitor_lens_toggle',
    '58_operator_signum_dashboard','59_praeceptum_memory_update',
    '60_praeceptum_adaptive_prompt_order','61_operator_guidance_dashboard',
    '62_lumen_signal_detection','63_operator_lumen_dashboard','64_assistchip_lumen_prompt',
    '66_operator_partners_list','67_operator_scheduling','68_operator_outreach',
    '69_operator_activation','70_operator_error_desk','71_operator_qa_page',
    '72_operator_manuals','73_operator_time_machine','74_operator_announcements',
    '75_operator_ecosystem','76_operator_overrides','77_nexus_home','78_nexus_playbooks',
    '79_nexus_support_inbox','80_nexus_activation_manager','81_nexus_expansion',
    '82_nexus_knowledge','83_nexus_rhythm','84_nexus_presence','85_nexus_arrival',
    '86_nexus_recovery','87_nexus_narrative','88_nexus_narrative_studio',
    '89_nexus_civitas_studio','90_nexus_adoption','91_nexus_stability',
    '92_nexus_narrative_ecosystem','93_guided_activation_prep'
  )
);

-- Delete the runs themselves
DELETE FROM qa_test_runs WHERE suite_key IN (
  '09_operator_console_admin_loads','10_demo_lab_admin_loads',
  '38_lens_shepherd_nav','39_lens_companion_restricted','40_lens_visitor_redirects',
  '41_full_workspace_toggle','41_visitor_lens_toggle',
  '58_operator_signum_dashboard','59_praeceptum_memory_update',
  '60_praeceptum_adaptive_prompt_order','61_operator_guidance_dashboard',
  '62_lumen_signal_detection','63_operator_lumen_dashboard','64_assistchip_lumen_prompt',
  '66_operator_partners_list','67_operator_scheduling','68_operator_outreach',
  '69_operator_activation','70_operator_error_desk','71_operator_qa_page',
  '72_operator_manuals','73_operator_time_machine','74_operator_announcements',
  '75_operator_ecosystem','76_operator_overrides','77_nexus_home','78_nexus_playbooks',
  '79_nexus_support_inbox','80_nexus_activation_manager','81_nexus_expansion',
  '82_nexus_knowledge','83_nexus_rhythm','84_nexus_presence','85_nexus_arrival',
  '86_nexus_recovery','87_nexus_narrative','88_nexus_narrative_studio',
  '89_nexus_civitas_studio','90_nexus_adoption','91_nexus_stability',
  '92_nexus_narrative_ecosystem','93_guided_activation_prep'
);

-- Delete the suites themselves
DELETE FROM qa_test_suites WHERE key IN (
  '09_operator_console_admin_loads','10_demo_lab_admin_loads',
  '38_lens_shepherd_nav','39_lens_companion_restricted','40_lens_visitor_redirects',
  '41_full_workspace_toggle','41_visitor_lens_toggle',
  '58_operator_signum_dashboard','59_praeceptum_memory_update',
  '60_praeceptum_adaptive_prompt_order','61_operator_guidance_dashboard',
  '62_lumen_signal_detection','63_operator_lumen_dashboard','64_assistchip_lumen_prompt',
  '66_operator_partners_list','67_operator_scheduling','68_operator_outreach',
  '69_operator_activation','70_operator_error_desk','71_operator_qa_page',
  '72_operator_manuals','73_operator_time_machine','74_operator_announcements',
  '75_operator_ecosystem','76_operator_overrides','77_nexus_home','78_nexus_playbooks',
  '79_nexus_support_inbox','80_nexus_activation_manager','81_nexus_expansion',
  '82_nexus_knowledge','83_nexus_rhythm','84_nexus_presence','85_nexus_arrival',
  '86_nexus_recovery','87_nexus_narrative','88_nexus_narrative_studio',
  '89_nexus_civitas_studio','90_nexus_adoption','91_nexus_stability',
  '92_nexus_narrative_ecosystem','93_guided_activation_prep'
);