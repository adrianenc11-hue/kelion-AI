# K — Meserii Susținute & Analiza Tool-uri

> **🌍 CERINȚĂ FUNDAMENTALĂ: ADAPTARE PE ȚARĂ**
> K se adaptează automat la legislația, standardele și reglementările țării utilizatorului.
>
> - **Contabil** → legislație fiscală locală (ANAF în România, HMRC în UK, IRS în SUA, etc.)
> - **Avocat** → cod civil/penal al țării, jurisprudență locală
> - **Constructor** → norme de construcții locale (P100 în RO, Eurocode în UE)
> - **HR** → cod muncii local, drepturi angajați per țară
> - **Medic** → protocoale medicale naționale, farmacopee locală
> - **Contabil** → plan de conturi local, TVA/VAT rates, declarații fiscale specifice
> - **Agent imobiliar** → legi proprietate, impozite locale
> - **Transport** → reglementări rutiere, greutăți maxime, ore de condus per țară
>
> Detectare automată: GPS + setări limba + IP → identificare țară → aplicare legislație corespunzătoare.
> Tool necesar: `country_detector` + `legal_database` per jurisdicție.

## 📋 CODIFICARE MESERII — Nomenclatoare Oficiale

> **Sisteme de codificare per țară:**
>
> - 🇷🇴 **COR** (Clasificarea Ocupațiilor din România)
> - 🌍 **ISCO-08** (International Standard Classification of Occupations — ONU/ILO)
> - 🇺🇸 **SOC** (Standard Occupational Classification — SUA)
> - 🇬🇧 **UK SOC** (Standard Occupational Classification — UK)
> - 🇨🇦 **NOC** (National Occupational Classification — Canada)
> - 🇩🇪 **KldB** (Klassifikation der Berufe — Germania)

| Meserie | COR (RO) | ISCO-08 | SOC (US) | Echivalent |
| --- | --- | --- | --- | --- |
| Programator | 251401 | 2514 | 15-1252 | Software Developer |
| Contabil | 241101 | 2411 | 13-2011 | Accountant |
| Avocat | 261101 | 2611 | 23-1011 | Lawyer |
| Profesor (secundar) | 233001 | 2330 | 25-2031 | Teacher |
| Profesor (primar) | 234101 | 2341 | 25-2021 | Primary Teacher |
| Arhitect | 216101 | 2161 | 17-1011 | Architect |
| Medic generalist | 221101 | 2211 | 29-1215 | Physician |
| Medic specialist | 221201 | 2212 | 29-1218 | Medical Specialist |
| Inginer mecanic | 214401 | 2144 | 17-2141 | Mechanical Engineer |
| Inginer constructor | 214201 | 2142 | 17-2051 | Civil Engineer |
| Inginer electric | 215101 | 2151 | 17-2071 | Electrical Engineer |
| Traducător | 264306 | 2643 | 27-3091 | Translator |
| Farmacist | 226201 | 2262 | 29-1051 | Pharmacist |
| Jurnalist | 264211 | 2642 | 27-3023 | Journalist |
| Fotograf | 343101 | 3431 | 27-4021 | Photographer |
| Agent imobiliar | 333401 | 3334 | 41-9022 | Real Estate Agent |
| Bucătar | 512001 | 5120 | 35-2014 | Cook |
| Bucătar-șef | 343403 | 3434 | 35-1011 | Head Chef |
| Electrician | 741101 | 7411 | 47-2111 | Electrician |
| Șofer | 832201 | 8322 | 53-3032 | Driver |
| Designer grafic | 216611 | 2166 | 27-1024 | Graphic Designer |
| Asistent social | 263501 | 2635 | 21-1021 | Social Worker |
| Topograf | 216504 | 2165 | 17-1022 | Surveyor |
| Meteorolog | 211101 | 2111 | 19-2021 | Meteorologist |
| Economist | 263102 | 2631 | 19-3011 | Economist |
| Psiholog | 263401 | 2634 | 19-3031 | Psychologist |
| Manager HR | 121201 | 1212 | 11-3121 | HR Manager |
| Marketing specialist | 243101 | 2431 | 13-1161 | Marketing Analyst |
| Notar | 261201 | 2612 | 23-2011 | Notary |
| Executor judecătoresc | 261301 | 2619 | 23-2011 | Bailiff |
| Actuar | 212101 | 2121 | 15-2011 | Actuary |
| Data Scientist | 252101 | 2521 | 15-2051 | Data Scientist |
| DevOps Engineer | 252301 | 2523 | 15-1244 | DevOps Engineer |
| Bibliotecar | 262201 | 2622 | 25-4022 | Librarian |
| Antrenor sportiv | 342201 | 3422 | 27-2022 | Sports Coach |
| Fizioterapeut | 226401 | 2264 | 29-1123 | Physiotherapist |
| Nutriționist | 226501 | 2265 | 29-1031 | Dietitian |
| Medic veterinar | 225101 | 2250 | 29-1131 | Veterinarian |
| Agent de asigurări | 332101 | 3321 | 41-3021 | Insurance Agent |
| Broker financiar | 331101 | 3311 | 41-3031 | Financial Broker |

> **K detectează automat țara utilizatorului** și aplică nomenclatorul corespunzător.
> Exemplu: un contabil din 🇷🇴 vede COR 241101, din 🇺🇸 vede SOC 13-2011, din 🇩🇪 vede KldB 72132.

## 28 Tool-uri Active

| # | Tool | Ce face |
|---|------|---------|
| 1 | `search_web` | Caută pe internet |
| 2 | `generate_image` | Generează imagini AI |
| 3 | `translate_text` | Traduce text |
| 4 | `get_weather` | Meteo live |
| 5 | `do_math` | Calcule matematice |
| 6 | `run_code` | Execuție cod |
| 7 | `generate_video` | Video AI |
| 8 | `generate_music` | Muzică AI |
| 9 | `manage_notes` | Note (create/list) |
| 10 | `browse_webpage` | Citire pagini web |
| 11 | `manage_calendar` | Calendar & evenimente |
| 12 | `deep_research` | Research aprofundat |
| 13 | `create_podcast` | Podcast AI |
| 14 | `read_text_from_image` | OCR din imagine |
| 15 | `analyze_image` | Analiză vizuală |
| 16 | `create_presentation` | Prezentări |
| 17 | `draw_on_canvas` | Desen/diagrame |
| 18 | `send_email` | Email |
| 19 | `strategic_planning` | Planificare strategică |
| 20 | `save_memory` | Salvare memorie |
| 21 | `recall_memory` | Reamintire |
| 22 | `semantic_search` | Căutare semantică |
| 23 | `read_aloud` | Text-to-speech |
| 24 | `manage_user_profile` | Profil utilizator |
| 25 | `supreme_intelligence` | Multi-AI analiză |
| 26 | `send_group_message` | Mesaje grup |
| 27 | `share_location` | Localizare |
| 28 | `transcribe_audio` | Speech-to-text |

---

## Meserii & Analiză Completă

### 🎓 EDUCAȚIE & TRAINING

#### Profesor (orice materie)

- ✅ Avem: `search_web`, `deep_research`, `browse_webpage`, `create_presentation`, `generate_image`, `save_memory`, `read_aloud`
- ❌ Lipsă: `export_document` (PDF lecție), `display_in_workspace` (afișare lecție), `set_role` (rol persistent profesor), `quiz_generator` (teste automate cu notare)

#### Tutor particular

- ✅ Avem: chat roleplay, `save_memory` (progres elev), `manage_notes`, `do_math`, `deep_research`
- ❌ Lipsă: `track_progress` (urmărire progres elev), `export_document` (raport progres), `set_role`

#### Profesor limbi străine

- ✅ Avem: `translate_text`, `read_aloud` (pronunție), `transcribe_audio` (verifică pronunția), `save_memory`
- ❌ Lipsă: `pronunciation_check` (comparare pronunție), `vocabulary_tracker` (cuvinte învățate)

#### Formator corporate

- ✅ Avem: `create_presentation`, `strategic_planning`, `manage_notes`, `generate_image`
- ❌ Lipsă: `export_document` (materiale curs), `quiz_generator`

---

### 💼 BUSINESS & MANAGEMENT

#### Antreprenor

- ✅ Avem: `strategic_planning`, `deep_research`, `do_math`, `send_email`, `search_web`, `manage_calendar`
- ❌ Lipsă: `financial_calculator` (cash flow, ROI, break-even), `invoice_generator` (facturi)

#### Consultant business

- ✅ Avem: `strategic_planning`, `search_web`, `create_presentation`, `deep_research`, `do_math`
- ❌ Lipsă: `export_document` (rapoarte), `chart_generator` (grafice business)

#### Manager de proiect

- ✅ Avem: `manage_calendar`, `manage_notes`, `send_email`, `send_group_message`, `strategic_planning`
- ❌ Lipsă: `task_tracker` (urmărire task-uri echipă), `gantt_chart` (timeline proiect)

#### Analist de piață

- ✅ Avem: `deep_research`, `search_web`, `browse_webpage`, `do_math`, `strategic_planning`
- ❌ Lipsă: `chart_generator`, `data_visualizer` (grafice din date), `export_document`

#### Planificator financiar

- ✅ Avem: `do_math`, `strategic_planning`, `deep_research`, `manage_notes`
- ❌ Lipsă: `financial_calculator` (amortizări, dobânzi, investiții), `chart_generator`

#### HR / Recruiter

- ✅ Avem: `send_email`, `manage_notes`, `search_web`, `manage_calendar`, `save_memory`
- ❌ Lipsă: `cv_analyzer` (analiză CV), `template_generator` (scrisori, contracte)

#### Asistent executiv / Virtual Assistant

- ✅ Avem: TOATE 28 tool-urile — **100% acoperit**
- ❌ Lipsă: nimic semnificativ

---

### 💻 IT & PROGRAMARE

#### Programator / Developer

- ✅ Avem: `run_code`, `search_web`, `browse_webpage`, `deep_research`, `manage_notes`
- ❌ Lipsă: `debug_code` (debugging avansat), `git_operations` (commit/push/PR), `file_manager` (creare/editare fișiere)

#### Data Analyst / Scientist

- ✅ Avem: `run_code`, `do_math`, `deep_research`, `search_web`
- ❌ Lipsă: `chart_generator`, `data_visualizer`, `csv_parser` (import/export date)

#### DevOps / SysAdmin

- ✅ Avem: `run_code`, `search_web`, `manage_notes`
- ❌ Lipsă: `server_monitor` (status servere), `log_analyzer` (analiză loguri)

#### QA Tester

- ✅ Avem: `run_code`, `analyze_image` (UI), `manage_notes`, `search_web`
- ❌ Lipsă: `screenshot_compare` (comparare vizuală), `test_runner` (rulare teste automate)

---

### 🎨 CREATIV & DESIGN

#### Graphic Designer

- ✅ Avem: `generate_image`, `draw_on_canvas`, `analyze_image`, `search_web`
- ❌ Lipsă: `image_editor` (resize, crop, filtre), `color_palette` (generare palete), `export_document` (export high-res)

#### Video Creator / YouTuber

- ✅ Avem: `generate_video`, `generate_image` (thumbnails), `generate_music`, `search_web`, `run_code`
- ❌ Lipsă: `video_editor` (montaj), `subtitle_generator` (subtitrări), `thumbnail_optimizer`

#### Muzician / Producător

- ✅ Avem: `generate_music`, `create_podcast`, `read_aloud`, `transcribe_audio`
- ❌ Lipsă: `audio_editor` (mix, master), `lyrics_generator` (versuri)

#### Copywriter / Content Writer

- ✅ Avem: chat (scris), `search_web`, `translate_text`, `deep_research`, `manage_notes`
- ❌ Lipsă: `seo_analyzer` (optimizare SEO), `plagiarism_check`, `readability_score`

#### Podcaster

- ✅ Avem: `create_podcast`, `deep_research`, `manage_notes`, `transcribe_audio`, `read_aloud`
- ❌ Lipsă: `audio_editor`, `show_notes_generator`

#### Fotograf

- ✅ Avem: `analyze_image`, `generate_image`, `read_text_from_image`
- ❌ Lipsă: `image_editor`, `exif_reader` (metadata), `watermark`

---

### 📣 MARKETING & PUBLICITATE

#### Director de Marketing

- ✅ Avem: `strategic_planning`, `deep_research`, `search_web`, `generate_image`, `create_presentation`, `do_math`
- ❌ Lipsă: `campaign_tracker` (urmărire campanii), `analytics_dashboard`, `ab_test_analyzer`

#### Marketing Digital / Performance Marketing

- ✅ Avem: `search_web`, `deep_research`, `do_math` (ROI, ROAS), `generate_image` (reclame), `strategic_planning`
- ❌ Lipsă: `ad_copy_generator`, `landing_page_analyzer`, `keyword_research`, `analytics_dashboard`

#### Email Marketing Specialist

- ✅ Avem: `send_email`, `generate_image`, `search_web`, `manage_calendar`, `do_math` (open rates)
- ❌ Lipsă: `email_template_builder`, `a_b_test`, `subscriber_analytics`

#### Brand Manager

- ✅ Avem: `strategic_planning`, `generate_image`, `deep_research`, `search_web`, `create_presentation`
- ❌ Lipsă: `brand_guidelines_generator`, `competitor_monitor`, `sentiment_analyzer`

#### Afilist / Influencer Marketing

- ✅ Avem: `search_web`, `do_math` (comisioane), `send_email`, `generate_image`, `manage_notes`
- ❌ Lipsă: `affiliate_tracker`, `influencer_finder`

---

### 🚛 TRANSPORT & LOGISTICĂ

#### Dispecer transport

- ✅ Avem: `share_location` (tracking), `manage_calendar` (programări), `send_group_message` (comunicare șoferi), `do_math` (distanțe, costuri), `get_weather` (condiții drum)
- ❌ Lipsă: `route_optimizer` (optimizare rute), `fleet_tracker` (monitorizare flotă), `delivery_scheduler`

#### Manager logistică

- ✅ Avem: `strategic_planning`, `do_math` (stocuri, costuri), `manage_calendar`, `send_email`, `share_location`
- ❌ Lipsă: `inventory_tracker`, `supply_chain_monitor`, `warehouse_planner`

#### Curier / Șofer livrări

- ✅ Avem: `share_location`, `get_weather`, `manage_calendar`, `send_group_message`
- ❌ Lipsă: `route_optimizer`, `delivery_tracker`, `proof_of_delivery`

#### Agent vamal / Broker transport

- ✅ Avem: `search_web` (reglementări), `deep_research`, `do_math` (taxe), `translate_text`, `manage_notes`
- ❌ Lipsă: `customs_calculator`, `document_generator` (CMR, AWB), `currency_converter`

#### Manager flotă

- ✅ Avem: `share_location`, `manage_calendar` (revizii), `do_math` (consum carburant), `save_memory` (istoric vehicule)
- ❌ Lipsă: `fleet_tracker`, `maintenance_scheduler`, `fuel_calculator`

---

### 📊 CONTABILITATE & FINANȚE

#### Contabil

- ✅ Avem: `do_math`, `manage_notes`, `save_memory`, `send_email`, `manage_calendar` (deadline-uri fiscale)
- ❌ Lipsă: `invoice_generator`, `tax_calculator`, `financial_report`, `ledger_manager`

#### Economist

- ✅ Avem: `do_math`, `deep_research`, `search_web`, `strategic_planning`, `create_presentation`
- ❌ Lipsă: `chart_generator`, `financial_calculator`, `economic_indicators`

#### Broker de asigurări

- ✅ Avem: `search_web`, `do_math` (prime), `send_email`, `manage_calendar`, `save_memory` (clienți)
- ❌ Lipsă: `insurance_calculator`, `policy_comparator`, `crm_integration`

#### Auditor

- ✅ Avem: `deep_research`, `do_math`, `manage_notes`, `browse_webpage` (reglementări)
- ❌ Lipsă: `audit_checklist`, `compliance_checker`, `export_document`

#### Trader / Broker bursă

- ✅ Avem: `search_web`, `do_math`, `deep_research`, `save_memory`
- ❌ Lipsă: `stock_tracker`, `chart_generator`, `market_alerts`, `financial_calculator`

---

### 🏗️ CONSTRUCȚII & IMOBILIARE

#### Inginer constructor

- ✅ Avem: `do_math` (calcule structurale), `generate_image` (schițe), `deep_research`, `draw_on_canvas`
- ❌ Lipsă: `material_calculator`, `blueprint_viewer`, `cost_estimator`

#### Diriginte de șantier

- ✅ Avem: `manage_calendar`, `send_group_message`, `manage_notes` (jurnalul zilnic), `share_location`, `do_math`
- ❌ Lipsă: `site_report_generator`, `progress_tracker`, `safety_checklist`

#### Evaluator imobiliar

- ✅ Avem: `search_web`, `do_math`, `deep_research`, `save_memory`, `share_location`
- ❌ Lipsă: `property_comparator`, `valuation_calculator`, `export_document`

#### Agent imobiliar

- ✅ Avem: `search_web`, `do_math`, `send_email`, `share_location`, `generate_image`, `manage_calendar`
- ❌ Lipsă: `mortgage_calculator`, `property_comparator`, `virtual_tour`

#### Designer interior

- ✅ Avem: `generate_image` (concepts), `search_web`, `draw_on_canvas`, `create_presentation`
- ❌ Lipsă: `mood_board_generator`, `color_palette`, `3d_viewer`, `material_catalog`

---

### 🍽️ HoReCa (Hotel, Restaurant, Cafe)

#### Manager restaurant

- ✅ Avem: `manage_calendar` (rezervări), `do_math` (costuri), `strategic_planning`, `send_email`, `manage_notes`
- ❌ Lipsă: `menu_generator`, `inventory_tracker`, `staff_scheduler`, `recipe_calculator`

#### Chef / Bucătar

- ✅ Avem: `search_web` (rețete), `do_math` (conversii), `translate_text` (rețete internaționale), `save_memory`
- ❌ Lipsă: `recipe_converter` (porții), `nutrition_calculator`, `menu_planner`

#### Manager hotel

- ✅ Avem: `manage_calendar`, `send_email`, `translate_text`, `strategic_planning`, `do_math`, `get_weather`
- ❌ Lipsă: `booking_manager`, `room_availability`, `review_responder`, `staff_scheduler`

#### Barista / Barman

- ✅ Avem: `search_web` (rețete), `save_memory` (preferințe clienți), `do_math` (stocuri)
- ❌ Lipsă: `recipe_database`, `inventory_tracker`

#### Organizator catering

- ✅ Avem: `manage_calendar`, `do_math`, `send_email`, `strategic_planning`, `send_group_message`
- ❌ Lipsă: `menu_generator`, `cost_estimator`, `guest_counter`

---

### 🌾 AGRICULTURĂ & MEDIU

#### Fermier / Agricultor

- ✅ Avem: `get_weather`, `search_web`, `do_math` (randamente), `manage_calendar` (sezon), `share_location`
- ❌ Lipsă: `crop_planner`, `soil_analyzer`, `market_prices`, `irrigation_scheduler`

#### Inginer agronom

- ✅ Avem: `deep_research`, `get_weather`, `do_math`, `search_web`, `analyze_image` (boli plante)
- ❌ Lipsă: `plant_identifier`, `pest_database`, `fertilizer_calculator`

#### Medic veterinar

- ✅ Avem: `deep_research`, `search_web`, `manage_calendar`, `save_memory` (fișe pacienți), `manage_notes`
- ❌ Lipsă: `patient_records`, `drug_interaction_checker`, `treatment_protocol`

#### Inspector de mediu

- ✅ Avem: `deep_research`, `search_web`, `browse_webpage` (legislație), `manage_notes`, `share_location`
- ❌ Lipsă: `environmental_metrics`, `compliance_checklist`, `report_generator`

---

### 🚗 AUTO & TEHNIC

#### Mecanic auto

- ✅ Avem: `search_web` (manuale), `analyze_image` (diagnostic vizual), `save_memory` (istoric reparații), `manage_notes`
- ❌ Lipsă: `obd_reader` (coduri eroare), `parts_finder`, `repair_manual_search`

#### Inspector ITP / RAR

- ✅ Avem: `manage_calendar`, `manage_notes`, `search_web` (norme), `save_memory`
- ❌ Lipsă: `inspection_checklist`, `vehicle_database`, `report_generator`

#### Instructor auto

- ✅ Avem: `search_web` (legislație rutieră), `manage_calendar`, `save_memory` (progres elev), `share_location`
- ❌ Lipsă: `quiz_generator` (teste auto), `progress_tracker`, `route_planner`

#### Fleet Manager / Rental car

- ✅ Avem: `share_location`, `manage_calendar`, `do_math`, `send_email`, `save_memory`
- ❌ Lipsă: `fleet_tracker`, `maintenance_scheduler`, `booking_system`

---

### 💇 BEAUTY & WELLNESS

#### Stilist / Frizer

- ✅ Avem: `manage_calendar` (programări), `save_memory` (preferințe client), `generate_image` (sugestii look), `search_web`
- ❌ Lipsă: `booking_system`, `client_gallery`, `product_inventory`

#### Cosmetician / Makeup artist

- ✅ Avem: `analyze_image` (analiză ten), `generate_image` (look), `manage_calendar`, `save_memory`
- ❌ Lipsă: `skin_analyzer`, `product_recommender`, `before_after_gallery`

#### Antrenor personal / Fitness coach

- ✅ Avem: `manage_calendar`, `save_memory` (progres), `do_math` (calorii), `search_web`, `create_presentation` (plan)
- ❌ Lipsă: `workout_planner`, `nutrition_tracker`, `progress_chart`, `exercise_database`

#### Fizioterapeut

- ✅ Avem: `manage_calendar`, `save_memory` (fișă pacient), `deep_research`, `search_web`, `manage_notes`
- ❌ Lipsă: `exercise_library`, `patient_progress`, `treatment_plan_generator`

#### Maseur

- ✅ Avem: `manage_calendar`, `save_memory` (preferințe), `send_email` (confirmări)
- ❌ Lipsă: `booking_system`, `client_notes`, `body_map`

---

### ⚽ SPORT & ENTERTAINMENT

#### Antrenor sportiv

- ✅ Avem: `manage_calendar` (antrenamente), `save_memory` (performanțe), `do_math` (statistici), `generate_video`
- ❌ Lipsă: `training_planner`, `performance_tracker`, `match_analyzer`

#### Scout sportiv

- ✅ Avem: `search_web`, `deep_research`, `save_memory`, `manage_notes`, `analyze_image` (video analysis)
- ❌ Lipsă: `player_database`, `stats_comparator`, `report_generator`

#### DJ / Producător muzical

- ✅ Avem: `generate_music`, `search_web`, `manage_calendar`, `send_email`
- ❌ Lipsă: `playlist_generator`, `bpm_analyzer`, `audio_mixer`

#### Manager de artiști

- ✅ Avem: `manage_calendar`, `send_email`, `strategic_planning`, `do_math` (contracte), `manage_notes`
- ❌ Lipsă: `contract_generator`, `tour_planner`, `revenue_tracker`

---

### 🏛️ ADMINISTRAȚIE & FUNCȚIONAR PUBLIC

#### Funcționar public

- ✅ Avem: `manage_calendar`, `manage_notes`, `send_email`, `search_web` (legislație), `browse_webpage`
- ❌ Lipsă: `document_generator` (adeverințe, cereri), `registry_manager`, `export_document`

#### Notar

- ✅ Avem: `manage_notes`, `save_memory`, `manage_calendar`, `send_email`, `search_web`
- ❌ Lipsă: `legal_template`, `document_archive`, `fee_calculator`

#### Executor judecătoresc

- ✅ Avem: `manage_calendar`, `share_location`, `send_email`, `manage_notes`, `do_math`
- ❌ Lipsă: `case_tracker`, `legal_template`, `deadline_monitor`

---

### 🔬 FARMA & CHIMIE

#### Farmacist

- ✅ Avem: `search_web`, `deep_research`, `browse_webpage`, `do_math` (dozaje), `save_memory`
- ❌ Lipsă: `drug_interaction_checker`, `dosage_calculator`, `patient_history`

#### Chimist / Laborant

- ✅ Avem: `do_math`, `deep_research`, `run_code` (calcule), `search_web`, `manage_notes`
- ❌ Lipsă: `periodic_table`, `formula_calculator`, `lab_protocol_template`

---

### 📦 FREELANCING & GIG ECONOMY

#### Freelancer (orice)

- ✅ Avem: `manage_calendar`, `send_email`, `manage_notes`, `do_math` (facturi), `strategic_planning`
- ❌ Lipsă: `invoice_generator`, `time_tracker`, `portfolio_builder`

#### Virtual Assistant

- ✅ Avem: TOATE 28 tool-urile — **100% acoperit**
- ❌ Lipsă: nimic semnificativ

#### Blogger / Vlogger

- ✅ Avem: `search_web`, `generate_image`, `deep_research`, `translate_text`, `generate_video`
- ❌ Lipsă: `seo_analyzer`, `content_calendar`, `analytics_dashboard`

---

### 📰 MEDIA & COMUNICARE

#### Jurnalist

- ✅ Avem: `search_web`, `deep_research`, `browse_webpage`, `transcribe_audio`, `manage_notes`
- ❌ Lipsă: `fact_checker` (verificare surse), `export_document`, `source_tracker`

#### PR / Comunicare

- ✅ Avem: `send_email`, `search_web`, `strategic_planning`, `create_presentation`, `manage_calendar`
- ❌ Lipsă: `press_release_template`, `media_monitor` (monitorizare presă)

#### Social Media Manager

- ✅ Avem: `generate_image`, `search_web`, `manage_calendar`, `generate_video`, `generate_music`
- ❌ Lipsă: `social_post_scheduler`, `hashtag_generator`, `analytics_dashboard`

#### Traducător profesionist

- ✅ Avem: `translate_text`, `browse_webpage`, `read_text_from_image`, `read_aloud`
- ❌ Lipsă: `glossary_manager`, `translation_memory`, `export_document`

#### Prezentator TV / Radio

- ✅ Avem: `search_web`, `deep_research`, `transcribe_audio`, `read_aloud`, `manage_notes`
- ❌ Lipsă: `teleprompter`, `script_generator`, `media_archive`

#### Editor video / post-producție

- ✅ Avem: `generate_video`, `generate_image`, `generate_music`, `transcribe_audio`
- ❌ Lipsă: `video_editor`, `subtitle_generator`, `color_grading`

---

### ⚖️ JURIDIC & LEGAL

#### Avocat / Jurist

- ✅ Avem: `deep_research`, `search_web`, `browse_webpage`, `manage_notes`, `save_memory`, `manage_calendar`
- ❌ Lipsă: `legal_template` (modele contracte), `case_tracker` (urmărire dosare), `export_document`

#### Consilier juridic

- ✅ Avem: `deep_research`, `strategic_planning`, `send_email`, `manage_notes`, `browse_webpage`
- ❌ Lipsă: `legal_template`, `compliance_checker`, `export_document`

#### Mediator

- ✅ Avem: `manage_calendar`, `manage_notes`, `save_memory`, `send_email`
- ❌ Lipsă: `mediation_protocol`, `agreement_template`, `export_document`

#### Executor judecătoresc

- ✅ Avem: `manage_calendar`, `share_location`, `send_email`, `manage_notes`, `do_math`
- ❌ Lipsă: `case_tracker`, `legal_template`, `deadline_monitor`

#### Consilier fiscal

- ✅ Avem: `do_math`, `deep_research`, `search_web`, `manage_calendar`, `send_email`
- ❌ Lipsă: `tax_calculator`, `fiscal_calendar`, `export_document`

---

### 🏥 SĂNĂTATE (informativ, nu diagnostic)

#### Medic generalist (informare)

- ✅ Avem: `deep_research`, `search_web`, `browse_webpage`, `manage_calendar`, `save_memory`, `manage_notes`
- ❌ Lipsă: `patient_records`, `drug_interaction_checker`, `medical_reference`

#### Cercetător medical

- ✅ Avem: `deep_research`, `search_web`, `browse_webpage`, `do_math`, `run_code`
- ❌ Lipsă: `citation_manager`, `data_visualizer`, `export_document`

#### Nutriționist

- ✅ Avem: `search_web`, `do_math` (calorii), `manage_notes` (plan), `save_memory`
- ❌ Lipsă: `meal_planner`, `nutrition_database`, `recipe_calculator`

#### Coach / Psiholog

- ✅ Avem: chat conversational, `save_memory` (progres), `manage_calendar`, `manage_notes`
- ❌ Lipsă: `mood_tracker`, `progress_report`, `set_role`

#### Asistent medical

- ✅ Avem: `manage_calendar`, `manage_notes`, `save_memory`, `search_web`
- ❌ Lipsă: `patient_scheduler`, `medical_protocol`, `shift_planner`

#### Kinetoterapeut

- ✅ Avem: `manage_calendar`, `save_memory`, `deep_research`, `manage_notes`
- ❌ Lipsă: `exercise_library`, `patient_progress`, `treatment_plan_generator`

---

### 🏗️ INGINERIE & ȘTIINȚĂ

#### Inginer mecanic / electric

- ✅ Avem: `do_math`, `run_code`, `deep_research`, `draw_on_canvas`, `generate_image`
- ❌ Lipsă: `unit_converter`, `formula_library`, `cad_viewer`

#### Arhitect / Urbanist / Designer Interior

- ✅ Avem: `generate_image` (concepte vizuale, randări), `do_math` (calcule structurale), `draw_on_canvas` (schițe), `search_web` (materiale, prețuri), `deep_research` (coduri construcții), `create_presentation` (prezentări client), `analyze_image` (analiză teren/clădire), `translate_text` (proiecte internaționale)
- ❌ Lipsă: `3d_viewer` (vizualizare 3D), `floor_plan_generator` (planuri etaj), `material_calculator` (deviz materiale), `bim_viewer` (Building Information Modeling), `structural_analyzer` (analiză structurală), `render_engine` (randări fotorealiste), `building_code_checker` (verificare norme construcții per țară — P100/Eurocode/IBC)
- 🌍 Adaptare țară: norme seismice (P100 RO, Eurocode 8 UE), standarde izolație, reglementări urbanistice locale

#### Topograf / Inginer Cadastru / Geodez

- ✅ Avem: `do_math` (calcule suprafețe, coordonate), `share_location` (GPS), `analyze_image` (imagini satelit/drone), `deep_research` (reglementări cadastrale), `search_web` (prețuri terenuri), `draw_on_canvas` (schițe parcele), `manage_notes` (documentație)
- ❌ Lipsă: `gis_viewer` (Geographic Information System), `coordinate_converter` (sisteme de coordonate — Stereo70/WGS84/UTM), `parcel_calculator` (calcul suprafață parcelă din coordonate), `cadastral_map` (integrare ANCPI/cadastru), `elevation_profiler` (profil altimetric), `dxf_exporter` (export planuri CAD)
- 🌍 Adaptare țară: sisteme cadastrale diferite (ANCPI în RO, Land Registry în UK, Grundbuch în DE), sisteme de coordonate naționale

#### Cercetător / Scientist

- ✅ Avem: `deep_research`, `search_web`, `browse_webpage`, `do_math`, `run_code`, `manage_notes`
- ❌ Lipsă: `citation_manager`, `data_visualizer`, `export_document`

#### Meteorolog

- ✅ Avem: `get_weather`, `search_web`, `do_math`, `deep_research`
- ❌ Lipsă: `weather_map_advanced`, `climate_data`, `forecast_model`

#### Geolog / Geofizician

- ✅ Avem: `deep_research`, `search_web`, `do_math`, `analyze_image`, `share_location`
- ❌ Lipsă: `geological_maps`, `sample_database`, `terrain_analyzer`

#### Astronom / Astrofizician

- ✅ Avem: `deep_research`, `search_web`, `do_math`, `run_code` (simulări), `analyze_image` (imagini telescop), `generate_image` (vizualizări)
- ❌ Lipsă: `sky_map` (hartă cer), `ephemeris_calculator` (poziții corpuri cerești), `spectral_analyzer`, `telescope_control`

---

### 🔬 CERCETĂTORI (pe domenii)

#### Cercetător AI / Machine Learning

- ✅ Avem: `run_code` (Python, modele), `do_math`, `deep_research`, `search_web`, `browse_webpage` (papers), `manage_notes`
- ❌ Lipsă: `model_trainer`, `dataset_manager`, `experiment_tracker` (MLflow), `gpu_monitor`, `paper_search` (arXiv, Semantic Scholar)

#### Cercetător medical / bio-medical

- ✅ Avem: `deep_research`, `search_web`, `browse_webpage` (PubMed), `do_math` (statistică), `run_code`
- ❌ Lipsă: `citation_manager`, `clinical_trial_search`, `molecular_viewer`, `data_visualizer`, `export_document`

#### Cercetător juridic / drept

- ✅ Avem: `deep_research`, `search_web`, `browse_webpage` (legislație), `manage_notes`, `save_memory`
- ❌ Lipsă: `legal_database` (jurisprudență), `citation_formatter` (OSCOLA, Bluebook), `case_comparator`, `export_document`

#### Cercetător economic / finanțe

- ✅ Avem: `deep_research`, `search_web`, `do_math`, `run_code` (econometrie), `create_presentation`
- ❌ Lipsă: `chart_generator`, `dataset_loader` (World Bank, Eurostat), `regression_tool`, `financial_model`, `export_document`

#### Cercetător agricol / agronomie

- ✅ Avem: `deep_research`, `get_weather`, `do_math`, `analyze_image` (culturi, boli), `search_web`
- ❌ Lipsă: `soil_database`, `crop_model`, `gis_viewer`, `field_data_collector`, `satellite_imagery`

#### Cercetător mediu / ecologie

- ✅ Avem: `deep_research`, `search_web`, `share_location`, `do_math`, `analyze_image`
- ❌ Lipsă: `environmental_database`, `species_identifier`, `pollution_tracker`, `gis_viewer`, `climate_model`

#### Cercetător social / sociologie / psihologie

- ✅ Avem: `deep_research`, `search_web`, `do_math` (statistică), `run_code` (SPSS/R), `manage_notes`, `save_memory`
- ❌ Lipsă: `survey_builder`, `data_analyzer` (chi-square, ANOVA), `qualitative_coder`, `interview_transcriber`, `export_document`

#### Cercetător fizică / fizică nucleară

- ✅ Avem: `do_math`, `run_code` (simulări), `deep_research`, `search_web`, `draw_on_canvas`
- ❌ Lipsă: `physics_simulator`, `particle_database`, `unit_converter_advanced`, `latex_editor`, `data_visualizer`

#### Cercetător chimie / biochimie

- ✅ Avem: `do_math`, `run_code`, `deep_research`, `search_web`, `manage_notes`
- ❌ Lipsă: `periodic_table_interactive`, `molecule_viewer_3d`, `reaction_predictor`, `spectroscopy_analyzer`, `lab_notebook`

#### Cercetător biologie / genetică

- ✅ Avem: `deep_research`, `search_web`, `analyze_image` (microscopie), `run_code`, `do_math`
- ❌ Lipsă: `genome_browser`, `sequence_aligner` (BLAST), `phylogenetic_tree`, `protein_structure_viewer`, `lab_protocol_manager`

#### Cercetător matematică

- ✅ Avem: `do_math`, `run_code` (Wolfram, Python), `deep_research`, `search_web`, `draw_on_canvas`
- ❌ Lipsă: `symbolic_solver` (Mathematica/SymPy), `proof_assistant`, `latex_editor`, `graph_plotter`, `theorem_database`

#### Cercetător istorie / arheologie

- ✅ Avem: `deep_research`, `search_web`, `browse_webpage`, `analyze_image` (artefacte), `translate_text`, `manage_notes`
- ❌ Lipsă: `archive_search`, `timeline_builder`, `map_historical`, `artifact_catalog`, `carbon_dating_calc`

#### Cercetător lingvistică / filologie

- ✅ Avem: `deep_research`, `translate_text`, `search_web`, `transcribe_audio`, `read_aloud`, `manage_notes`
- ❌ Lipsă: `corpus_analyzer`, `etymology_database`, `phonetic_transcriber` (IPA), `language_frequency_tool`, `dialect_mapper`

#### Cercetător cyber security

- ✅ Avem: `run_code`, `deep_research`, `search_web`, `browse_webpage`, `manage_notes`
- ❌ Lipsă (REGIM SPECIAL): `cve_database`, `malware_analyzer`, `network_traffic_analyzer`, `vulnerability_research_sandbox`, `threat_model_builder`

#### Cercetător spațiu / aerospace

- ✅ Avem: `do_math`, `run_code` (orbital mechanics), `deep_research`, `search_web`, `analyze_image`
- ❌ Lipsă: `orbital_simulator`, `telemetry_viewer`, `mission_planner`, `radiation_calculator`, `sky_map`

---

### 👶 K PENTRU COPII

> **Notă:** Aceasta este o zonă specială cu interfață simplificată, conținut filtrat, și control parental. K devine un companion educativ și de divertisment pentru copii.

#### Povestitor / Storyteller

- ✅ Avem: `read_aloud` (citire cu voce), `generate_image` (ilustrații), `generate_music` (fundal sonor), `save_memory` (poveștile preferate), `translate_text` (povești multilingve)
- ❌ Lipsă: `story_generator` (generare povești interactive), `character_builder` (personaje recurente), `choose_your_adventure` (povești ramificate), `bedtime_mode` (mod liniștitor seara)

#### Cântece și Muzică pentru Copii

- ✅ Avem: `generate_music` (melodii), `read_aloud` (cântare/recitare), `search_web` (versuri), `translate_text` (cântece internaționale)
- ❌ Lipsă: `lullaby_generator` (cântece de leagăn personalizate), `sing_along_mode` (karaoke copii), `music_library_kids` (bibliotecă de cântece), `rhythm_game` (joc de ritm)

#### Jocuri Educative

- ✅ Avem: `do_math` (probleme), `draw_on_canvas` (desen), `generate_image` (puzzle vizual), `read_aloud` (instrucțiuni vocale)
- ❌ Lipsă: `quiz_generator_kids` (teste adaptate vârstei), `reward_system` (stele, badge-uri), `difficulty_adapter` (adaptare nivel), `coloring_book` (carte de colorat digitală)

#### Supraveghere Video Copil (Baby Monitor AI)

- ✅ Avem: `analyze_image` (detectare vizuală), `transcribe_audio` (detectare plâns/sunete), `send_group_message` (alertă părinți), `share_location`
- ❌ Lipsă: `baby_monitor_mode` (cameră continuă + AI), `cry_detector` (clasificare plâns: foame/somn/durere), `motion_alert` (detectare mișcare), `sleep_tracker` (monitorizare somn), `parent_dashboard` (panou părinți)

#### Tutor Copii (3-12 ani)

- ✅ Avem: `read_aloud`, `do_math`, `generate_image`, `draw_on_canvas`, `search_web`, `manage_notes`
- ❌ Lipsă: `age_adapter` (adaptare conținut pe vârstă), `progress_tracker_kids` (progres per materie), `parent_report` (raport pentru părinți), `lesson_planner_kids`

#### Companion Virtual / Prieten Digital

- ✅ Avem: chat conversational, `save_memory` (preferințe copil), `generate_image` (desene), `read_aloud`, `generate_music`
- ❌ Lipsă: `personality_engine` (caracter persistent), `mood_detector` (stare emoțională), `safe_mode` (filtru conținut 100%), `screen_time_limiter`

**Cerințe speciale K pentru Copii:**

- 🛡️ Filtru conținut 100% — zero NSFW, violență, limbaj inadecvat
- 🛡️ Safe mode obligatoriu — nu poate fi dezactivat de copil
- 🛡️ Control parental — setări făcute doar de părinte cu PIN
- 🛡️ Limită de timp — screen time configurat de părinte
- 🛡️ Raport zilnic/săptămânal pentru părinți
- 🛡️ Voce prietenoasă, caldă, adaptată vârstei
- 🛡️ GDPR copii (COPPA compliance) — protecție date minori
- 🛡️ Fără reclame, fără achiziții in-app

---

### 🛒 VÂNZĂRI & RETAIL

#### Agent vânzări

- ✅ Avem: `send_email`, `manage_calendar`, `search_web`, `strategic_planning`, `save_memory`
- ❌ Lipsă: `crm_integration`, `invoice_generator`, `proposal_template`

#### E-commerce Manager

- ✅ Avem: `search_web`, `generate_image`, `do_math`, `strategic_planning`, `send_email`
- ❌ Lipsă: `product_description_generator`, `price_calculator`, `inventory_tracker`

#### Customer Support

- ✅ Avem: chat, `search_web`, `save_memory`, `send_email`, `recall_memory`
- ❌ Lipsă: `ticket_system`, `knowledge_base`, `satisfaction_survey`

#### Merchandiser

- ✅ Avem: `analyze_image`, `generate_image`, `search_web`, `manage_calendar`, `share_location`
- ❌ Lipsă: `planogram_generator`, `inventory_tracker`, `photo_report`

#### Buyer / Achiziții

- ✅ Avem: `search_web`, `do_math`, `send_email`, `manage_notes`, `strategic_planning`
- ❌ Lipsă: `price_comparator`, `supplier_database`, `currency_converter`

---

### 🏠 SERVICII PERSONALE

#### Travel Agent

- ✅ Avem: `search_web`, `get_weather`, `translate_text`, `manage_calendar`, `share_location`
- ❌ Lipsă: `flight_search`, `hotel_search`, `itinerary_generator`, `currency_converter`

#### Event Planner

- ✅ Avem: `manage_calendar`, `send_email`, `generate_image`, `strategic_planning`, `send_group_message`
- ❌ Lipsă: `budget_tracker`, `vendor_manager`, `checklist_generator`

#### Life Coach

- ✅ Avem: chat, `save_memory`, `manage_calendar`, `strategic_planning`, `manage_notes`
- ❌ Lipsă: `goal_tracker`, `habit_tracker`, `progress_report`, `set_role`

#### Ghid turistic

- ✅ Avem: `share_location`, `translate_text`, `search_web`, `get_weather`, `read_aloud`
- ❌ Lipsă: `tour_planner`, `poi_database`, `multi_language_audio`

#### Asistent maternal / Babysitter

- ✅ Avem: `manage_calendar`, `manage_notes`, `save_memory`, `search_web`
- ❌ Lipsă: `child_activity_planner`, `development_tracker`, `emergency_protocol`

---

### 🏫 EDUCAȚIE EXTINSĂ

#### Bibliotecar / Documentarist

- ✅ Avem: `search_web`, `browse_webpage`, `manage_notes`, `save_memory`, `semantic_search`
- ❌ Lipsă: `catalog_manager`, `isbn_lookup`, `citation_formatter`

#### Logoped

- ✅ Avem: `read_aloud`, `transcribe_audio`, `save_memory`, `manage_calendar`, `manage_notes`
- ❌ Lipsă: `pronunciation_check`, `exercise_library`, `progress_tracker`

#### Consilier educațional

- ✅ Avem: `search_web`, `deep_research`, `save_memory`, `manage_notes`, `manage_calendar`
- ❌ Lipsă: `career_database`, `university_finder`, `aptitude_test`

---

### 🎭 ARTĂ & CULTURĂ

#### Actor / Regizor

- ✅ Avem: `search_web`, `deep_research`, `read_aloud`, `generate_image`, `manage_calendar`
- ❌ Lipsă: `script_editor`, `audition_tracker`, `character_builder`

#### Muzician clasic / Dirijor

- ✅ Avem: `search_web`, `manage_calendar`, `manage_notes`, `translate_text`
- ❌ Lipsă: `score_reader`, `metronome`, `repertoire_manager`

#### Curator muzeu / Galerист

- ✅ Avem: `search_web`, `deep_research`, `generate_image`, `manage_calendar`, `create_presentation`
- ❌ Lipsă: `artwork_database`, `exhibition_planner`, `catalog_generator`

#### Scriitor / Autor

- ✅ Avem: chat (brainstorming), `deep_research`, `manage_notes`, `save_memory`, `translate_text`
- ❌ Lipsă: `manuscript_editor`, `word_count_tracker`, `publishing_guide`

---

### 🔧 MESERII TEHNICE / MEȘTEȘUGURI

#### Electrician

- ✅ Avem: `search_web` (scheme), `do_math` (calcule), `analyze_image` (identificare componente), `manage_notes`
- ❌ Lipsă: `wiring_diagram`, `electrical_calculator`, `parts_finder`

#### Instalator

- ✅ Avem: `search_web`, `do_math`, `manage_calendar`, `share_location`
- ❌ Lipsă: `plumbing_diagram`, `parts_catalog`, `estimate_calculator`

#### Sudor / Lăcătuș

- ✅ Avem: `search_web`, `do_math`, `analyze_image`, `manage_notes`
- ❌ Lipsă: `welding_spec_database`, `material_calculator`

#### Tâmplar / Mobilier

- ✅ Avem: `generate_image` (design), `do_math` (dimensiuni), `search_web`, `draw_on_canvas`
- ❌ Lipsă: `cutting_optimizer`, `material_calculator`, `3d_model`

---

### 🏦 ASIGURĂRI, BANKING & ACTUARIAT (din COR Grupa 2-3)

#### Actuar / Statistician

- ✅ Avem: `do_math`, `run_code` (modele statistice), `deep_research`, `search_web`, `manage_notes`
- ❌ Lipsă: `actuarial_table`, `risk_model`, `probability_calculator`, `mortality_table`, `insurance_pricer`
- 🌍 Adaptare: tabele mortalitate per țară, reglementări Solvency II (UE), NAIC (SUA)

#### Broker financiar / Agent bursă

- ✅ Avem: `search_web`, `do_math`, `deep_research`, `manage_notes`, `save_memory`
- ❌ Lipsă: `market_data_feed`, `portfolio_analyzer`, `regulatory_checker`
- 🌍 Adaptare: BVB (RO), LSE (UK), NYSE (SUA), autorități ASF/FCA/SEC

#### Agent de asigurări / Underwriter

- ✅ Avem: `do_math`, `search_web`, `deep_research`, `manage_notes`, `save_memory`, `send_email`
- ❌ Lipsă: `insurance_calculator`, `risk_profiler`, `policy_generator`, `claims_tracker`
- 🌍 Adaptare: legislație asigurări per țară (Legea 132/2000 RO, Insurance Act UK)

#### Analist bancar / Credit Officer

- ✅ Avem: `do_math`, `deep_research`, `search_web`, `manage_notes`, `run_code`
- ❌ Lipsă: `credit_scorer`, `loan_calculator`, `financial_ratio_analyzer`, `collateral_evaluator`
- 🌍 Adaptare: ROBOR/EURIBOR/LIBOR, cerințe BNR/BCE/Fed

---

### 🎨 DESIGN & CREATIVITATE (din COR Grupa 2)

#### Designer grafic / Multimedia

- ✅ Avem: `generate_image`, `draw_on_canvas`, `search_web`, `analyze_image`, `browse_webpage`
- ❌ Lipsă: `image_editor` (crop, resize, filtre), `color_palette_generator`, `mockup_generator`, `brand_kit_manager`

#### Designer UX/UI

- ✅ Avem: `generate_image` (mockups), `draw_on_canvas`, `search_web`, `deep_research`, `run_code` (prototyping)
- ❌ Lipsă: `wireframe_generator`, `user_flow_builder`, `accessibility_checker`, `design_system_manager`

#### Designer de modă / Stilist

- ✅ Avem: `generate_image` (schițe modă), `search_web` (tendințe), `analyze_image`, `deep_research`
- ❌ Lipsă: `pattern_generator` (tipare), `fabric_database`, `trend_analyzer`, `outfit_recommender`

---

### 📚 BIBLIOTECĂ, ARHIVĂ & MUZEU (din COR Grupa 2)

#### Bibliotecar / Documentarist

- ✅ Avem: `deep_research`, `search_web`, `browse_webpage`, `manage_notes`, `save_memory`, `translate_text`
- ❌ Lipsă: `catalog_manager` (MARC/Dublin Core), `isbn_lookup`, `citation_formatter`, `digital_archive`

#### Arhivist / Curator muzeu

- ✅ Avem: `deep_research`, `analyze_image` (artefacte), `manage_notes`, `search_web`, `translate_text`
- ❌ Lipsă: `artifact_catalog`, `provenance_tracker`, `conservation_guide`, `exhibition_planner`

---

### 🤝 SOCIAL, ONG & ASISTENȚĂ (din COR Grupa 2)

#### Asistent social

- ✅ Avem: `manage_notes`, `manage_calendar`, `send_email`, `deep_research`, `search_web`, `save_memory`
- ❌ Lipsă: `case_manager`, `benefit_calculator`, `referral_network`, `progress_tracker`
- 🌍 Adaptare: ajutoare sociale per țară, venit minim garantat, legislație protecție copil

#### Sociolog / Antropolog

- ✅ Avem: `deep_research`, `search_web`, `do_math` (statistică), `run_code` (analize), `manage_notes`
- ❌ Lipsă: `survey_builder`, `data_analyzer`, `demographics_database`, `qualitative_coder`

#### Manager ONG / Fundraiser

- ✅ Avem: `send_email`, `manage_calendar`, `create_presentation`, `deep_research`, `search_web`, `strategic_planning`
- ❌ Lipsă: `donor_manager`, `grant_finder`, `campaign_tracker`, `impact_reporter`

---

### ✈️ AVIAȚIE & NAVAL (din COR Grupa 3 — asistență, nu pilotaj)

#### Dispecer aerian / Controller trafic

- ✅ Avem: `do_math`, `manage_calendar`, `search_web`, `manage_notes`
- ❌ Lipsă: `flight_tracker`, `weather_aviation` (METAR/TAF), `airspace_viewer`, `notam_parser`

#### Ofițer naval / Marinar (asistență navigație)

- ✅ Avem: `do_math`, `get_weather`, `share_location`, `search_web`, `deep_research`
- ❌ Lipsă: `nautical_chart`, `tide_calculator`, `cargo_planner`, `port_database`

---

### 🎪 EVENIMENTE & ORGANIZARE (din COR Grupa 3)

#### Organizator evenimente / Wedding planner

- ✅ Avem: `manage_calendar`, `manage_notes`, `send_email`, `search_web`, `do_math` (bugete), `create_presentation`
- ❌ Lipsă: `vendor_manager`, `budget_tracker`, `seating_planner`, `timeline_builder`, `booking_system`

#### MC / Moderator / Prezentator

- ✅ Avem: `search_web`, `read_aloud`, `manage_notes`, `deep_research`, `translate_text`
- ❌ Lipsă: `script_generator`, `teleprompter_mode`, `audience_engagement_tool`

---

### 💻 MESERII DIGITALE MODERNE (internațional)

#### Data Scientist / Data Analyst

- ✅ Avem: `run_code` (Python, R), `do_math`, `deep_research`, `search_web`, `manage_notes`
- ❌ Lipsă: `data_visualizer`, `chart_generator`, `dataset_loader`, `ml_model_builder`, `export_document`

#### Product Manager

- ✅ Avem: `manage_notes`, `manage_calendar`, `strategic_planning`, `deep_research`, `create_presentation`, `search_web`
- ❌ Lipsă: `roadmap_builder`, `feature_prioritizer`, `user_story_generator`, `sprint_planner`

#### Scrum Master / Agile Coach

- ✅ Avem: `manage_calendar`, `manage_notes`, `strategic_planning`, `send_group_message`
- ❌ Lipsă: `sprint_board`, `burndown_chart`, `retrospective_tool`, `velocity_tracker`

#### Content Creator / Influencer

- ✅ Avem: `generate_image`, `generate_video`, `generate_music`, `search_web`, `browse_webpage`, `read_aloud`
- ❌ Lipsă: `social_media_scheduler`, `hashtag_analyzer`, `analytics_dashboard`, `content_calendar`

#### Blockchain Developer / Web3

- ✅ Avem: `run_code`, `deep_research`, `search_web`, `do_math`
- ❌ Lipsă: `smart_contract_auditor`, `gas_estimator`, `blockchain_explorer`, `wallet_manager`

#### DevOps / SRE Engineer

- ✅ Avem: `run_code`, `deep_research`, `search_web`, `manage_notes`
- ❌ Lipsă: `server_monitor`, `log_analyzer`, `ci_cd_manager`, `infrastructure_as_code`

#### Digital Nomad / Remote Worker

- ✅ Avem: `translate_text`, `get_weather`, `share_location`, `manage_calendar`, `send_email`, `currency_converter` (planned), `search_web`
- ❌ Lipsă: `visa_checker` (reguli vize per țară), `coworking_finder`, `timezone_converter`, `cost_of_living_compare`
- 🌍 Adaptare: vize digitale (Digital Nomad Visa), fiscalitate expat, asigurări călătorie

---

### 🛡️ MILITAR & APĂRARE — ⚠️ REGIM SPECIAL

> **Notă:** Această secțiune necesită acces controlat, autentificare avansată, și conformitate cu reglementări militare. Tool-urile vor fi disponibile doar pentru utilizatori verificați cu clearance corespunzător.

#### Ofițer / Comandant

- ✅ Avem: `strategic_planning`, `manage_calendar`, `send_group_message`, `share_location`, `manage_notes`, `create_presentation`
- ❌ Lipsă (REGIM SPECIAL): `tactical_planner`, `secure_messaging` (E2E encrypted), `map_overlay` (hărți tactice), `personnel_tracker`, `mission_briefing_generator`

#### Analist informații / Intelligence

- ✅ Avem: `deep_research`, `search_web`, `browse_webpage`, `semantic_search`, `analyze_image`, `save_memory`
- ❌ Lipsă (REGIM SPECIAL): `osint_toolkit` (Open Source Intelligence), `pattern_analyzer`, `threat_assessment`, `data_correlation`, `encrypted_storage`

#### Logistician militar

- ✅ Avem: `share_location`, `manage_calendar`, `do_math`, `strategic_planning`, `send_group_message`
- ❌ Lipsă (REGIM SPECIAL): `supply_chain_military`, `convoy_planner`, `inventory_tracker_secure`, `route_optimizer_tactical`

#### Comunicații militare

- ✅ Avem: `send_group_message`, `transcribe_audio`, `translate_text`, `read_aloud`
- ❌ Lipsă (REGIM SPECIAL): `secure_comms` (canal criptat), `signal_analyzer`, `frequency_manager`, `message_encoder`

#### Instructor militar

- ✅ Avem: `create_presentation`, `manage_calendar`, `strategic_planning`, `generate_image`, `save_memory`
- ❌ Lipsă (REGIM SPECIAL): `training_simulator`, `evaluation_system`, `combat_scenario_builder`, `fitness_tracker_military`

#### Medic militar

- ✅ Avem: `deep_research`, `search_web`, `manage_notes`, `save_memory`, `manage_calendar`
- ❌ Lipsă (REGIM SPECIAL): `trauma_protocol`, `triage_system`, `medical_supply_tracker`, `evacuation_planner`

**Cerințe regim special militar:**

- 🔐 Autentificare multi-factor cu token hardware
- 🔐 Comunicații E2E encrypted
- 🔐 Stocare date pe servere NATO/clasificate
- 🔐 Audit log complet pe fiecare acțiune
- 🔐 Air-gapped deployment opțional
- 🔐 Conformitate NATO STANAG / reglementări naționale

---

### 🔒 CYBER SECURITY — ⚠️ REGIM SPECIAL

> **Notă:** Această secțiune necesită acces controlat și verificare avansată. Tool-urile de securitate vor fi disponibile doar pentru profesioniști certificați, cu logging complet al tuturor acțiunilor.

#### Analist Cyber Security / SOC Analyst

- ✅ Avem: `search_web`, `deep_research`, `browse_webpage`, `run_code`, `save_memory`, `manage_notes`
- ❌ Lipsă (REGIM SPECIAL): `threat_intelligence_feed`, `ioc_scanner` (Indicators of Compromise), `log_analyzer`, `cve_database`, `malware_sandbox`

#### Penetration Tester / Ethical Hacker

- ✅ Avem: `run_code`, `search_web`, `browse_webpage`, `deep_research`
- ❌ Lipsă (REGIM SPECIAL): `vulnerability_scanner`, `exploit_database`, `network_mapper`, `report_generator_pentest`, `scope_validator`

#### Incident Response / DFIR

- ✅ Avem: `run_code`, `deep_research`, `manage_notes`, `save_memory`, `manage_calendar`
- ❌ Lipsă (REGIM SPECIAL): `forensic_toolkit`, `timeline_analyzer`, `evidence_collector`, `chain_of_custody`, `incident_report_generator`

#### Security Architect

- ✅ Avem: `strategic_planning`, `deep_research`, `create_presentation`, `draw_on_canvas`, `run_code`
- ❌ Lipsă (REGIM SPECIAL): `architecture_reviewer`, `compliance_checker` (ISO 27001, SOC2, GDPR), `risk_assessment_matrix`, `security_policy_generator`

#### CISO / Security Manager

- ✅ Avem: `strategic_planning`, `create_presentation`, `deep_research`, `send_email`, `manage_calendar`
- ❌ Lipsă (REGIM SPECIAL): `risk_dashboard`, `compliance_tracker`, `vendor_security_assessment`, `incident_metrics`, `board_report_generator`

#### Cryptographer

- ✅ Avem: `run_code`, `do_math`, `deep_research`, `search_web`
- ❌ Lipsă (REGIM SPECIAL): `crypto_toolkit`, `algorithm_tester`, `key_management`, `protocol_analyzer`

**Cerințe regim special cyber security:**

- 🔐 Zero Trust architecture
- 🔐 Sandbox izolat pentru cod potențial periculos
- 🔐 Logging complet + SIEM integration
- 🔐 Rate limiting strict pe tool-uri de scanning
- 🔐 Whitelist URL-uri permise pentru browse/test
- 🔐 Certificări necesare (CEH, OSCP, CISSP) pentru acces la anumite tool-uri
- 🔐 Disclaimer legal pe fiecare acțiune ofensivă
- 🔐 Conformitate SOC2 / ISO 27001

---

## 📊 REZUMAT GAP ANALYSIS

### Tool-uri noi necesare (prioritizate după câte meserii le-ar folosi)

| Tool NOU | Meserii beneficiare | Prioritate |
| --- | --- | --- |
| `export_document` (PDF, DOCX, XLS, PPT, ZIP, RAR) | 30+ meserii | 🔴 CRITIC |
| `chart_generator` (grafice) | 15+ meserii | 🔴 CRITIC |
| `set_role` (rol persistent) | 20+ meserii | 🔴 CRITIC |
| `template_generator` (modele doc) | 15+ meserii | 🟡 IMPORTANT |
| `report_generator` | 15+ meserii | 🟡 IMPORTANT |
| `document_generator` | 12+ meserii | 🟡 IMPORTANT |
| `invoice_generator` (facturi) | 10+ meserii | 🟡 IMPORTANT |
| `booking_system` (programări) | 8+ meserii | 🟡 IMPORTANT |
| `progress_tracker` | 10+ meserii | 🟡 IMPORTANT |
| `financial_calculator` | 8+ meserii | 🟡 IMPORTANT |
| `quiz_generator` (teste) | 6+ meserii | 🟡 IMPORTANT |
| `data_visualizer` | 8+ meserii | 🟡 IMPORTANT |
| `inventory_tracker` (stocuri) | 8+ meserii | 🟡 IMPORTANT |
| `route_optimizer` (rute) | 5+ meserii | 🟡 IMPORTANT |
| `currency_converter` | 5+ meserii | 🟢 NICE-TO-HAVE |
| `seo_analyzer` | 4+ meserii | 🟢 NICE-TO-HAVE |
| `analytics_dashboard` | 6+ meserii | 🟢 NICE-TO-HAVE |
| `image_editor` | 4+ meserii | 🟢 NICE-TO-HAVE |
| `audio_editor` | 3+ meserii | 🟢 NICE-TO-HAVE |
| `video_editor` | 3+ meserii | 🟢 NICE-TO-HAVE |
| `recipe_calculator` | 3+ meserii | 🟢 NICE-TO-HAVE |
| `workout_planner` | 3+ meserii | 🟢 NICE-TO-HAVE |

### Tool-uri REGIM SPECIAL (necesită dezvoltare separată)

| Tool | Secțiune | Cerințe |
| --- | --- | --- |
| `secure_messaging` | Militar | E2E encryption |
| `tactical_planner` | Militar | Air-gapped |
| `osint_toolkit` | Militar + Cyber | Controlled access |
| `threat_intelligence_feed` | Cyber Security | API security feeds |
| `vulnerability_scanner` | Cyber Security | Sandboxed |
| `forensic_toolkit` | Cyber Security | Chain of custody |
| `compliance_checker` | Cyber Security | ISO/SOC2/GDPR |

### Statistici

- **Total meserii analizate:** 150+
- **Categorii:** 28 (inclusiv 2 regim special + cercetători + copii + digital modern)
- **Meserii acoperite 100%:** 2 (Virtual Assistant, Asistent executiv)
- **Meserii acoperite 70%+:** 80+ meserii
- **Meserii acoperite 50-70%:** 50+ meserii
- **Meserii acoperite <50%:** ~20 meserii (editoare specializate, regim special)
- **Tool-uri existente:** 28
- **Tool-uri noi de construit:** 48+
- **Tool-uri regim special:** 7 + 7 clasificate
- **Codificare oficială:** COR (RO) + ISCO-08 + SOC (US)
- **Adaptare pe țară:** Legislație, nomenclator, standarde per jurisdicție

---

## 🏆 PRODUSE SPECIALE DERIVATE

### 👴 K Pension Assistant — PRIORITATE MAXIMĂ
>
> **Produs dedicat persoanelor în vârstă — 100% GRATUIT**
> Documentație completă: [`K_PENSION_ASSISTANT.md`](file:///c:/Users/adria/Downloads/k%20new/kelionat_clean/K_PENSION_ASSISTANT.md)

- Asistent AI specializat exclusiv pe pensii (RO + internațional)
- Prezență pe Instagram și TikTok (@k_pensii)
- Legislație reală verificată la nivel de avocat
- Text / Audio — fără avatar
- Cont gratuit nelimitat pentru pensionari
- Interfață simplificată (font mare, butoane clare)

### 📈 Robot de Bursă — CLASIFICAT
>
> Documentație: [`K_CLASSIFIED.md`](file:///c:/Users/adria/Downloads/k%20new/kelionat_clean/K_CLASSIFIED.md)
> Acces: Admin + VIP only
