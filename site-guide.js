(() => {
  "use strict";
  const chapters = [
    {
      id: "plot",
      title: "Survey the empty plot",
      intro:
        "Start with the movement of potatoes, people, vehicles, water and waste. A footprint commits you to an entrance, adjacent rooms and a way to service the equipment.",
      steps: [
        {
          title: "Orient the site plan",
          action:
            "Read rows A to D from north to south and columns 1 to 6 from west to east. Trace the delivery road along the western boundary. Identify where a vehicle would wait while a receiving bay is occupied.",
          reason:
            "A shared drawing orientation prevents a delivery entrance being confused with a finished-goods exit. The survey connects an empty plot to the way operators and drivers will use it.",
          accept:
            "You can locate A1 in the north-west and C1 beside the west road before placing a building.",
          fix: "If the entrances appear reversed, read the row and column labels and trace the external road again.",
        },
        {
          title: "Mark the flood reserve and entrance",
          action:
            "On Survey, mark A1 and A2 as the two flood-reserve cells. Choose C1 as the road entrance. Select Check survey. These coordinates belong to this fictional plot.",
          reason:
            "Keeping the surveyed flood area vacant protects access and avoids occupying unsuitable ground. A real survey would also establish levels, buried services, soil conditions and external flood paths.",
          accept:
            "Survey reports both reserve cells and the west entrance correctly. Leave A1 and A2 unoccupied in the worked layout.",
          fix: "Clear any additional marked reserve cell. Check the entrance selection separately from the two hazard selections.",
        },
        {
          title: "Trace raw and finished traffic",
          action:
            "Sketch the raw movement from the west gate towards intake. Draw a different final approach for frozen dispatch. Mark a protected pedestrian entrance, dedicated waste collection, emergency access and an area for unloading on your design sketch.",
          reason:
            "Vehicles carrying soil and raw potatoes create different hygiene and traffic conditions from finished-product loading. Separate approaches help prevent raw material or waste crossing finished dispatch.",
          accept:
            "The model will later require two distinct terminal aprons. Keep evidence of how the physical design handles pedestrian crossings and congestion.",
          fix: "If the sketch crosses a pedestrian doorway or finished-product route, change the approach while there is still space to move buildings.",
        },
      ],
      links: [
        {
          text: "Safe Work Australia · Safe design of structures",
          url: "https://www.safeworkaustralia.gov.au/doc/model-code-practice-safe-design-structures",
        },
        {
          text: "Food Standards Australia New Zealand · Safe Food Australia, Chapter 3.2.3",
          url: "https://www.foodstandards.gov.au/sites/default/files/2026-04/Safe-Food-Australia-4th-edition.pdf",
        },
      ],
    },
    {
      id: "buildings",
      title: "Set out and construct six buildings",
      intro:
        "Each footprint needs space for its process, maintenance access and adjoining flows. Use the grid drawing below to complete this exercise.",
      steps: [
        {
          title: "Place the raw intake and process hall",
          action:
            "Open Footprints. Choose the intake building, select B1, then Place footprint. Repeat with the process hall at B2. Put dirty receiving activities at the intake edge. Locate the wash and trim waste exit on the service side of the hall.",
          reason:
            "B1 receives potatoes from the west. Neighbouring B2 lets raw produce move into preparation without returning through finished logistics.",
          accept:
            "Intake B1 and process B2 appear on neighbouring cells. Their shared boundary represents a transfer interface.",
          fix: "If placement fails, check survey acceptance, cell occupancy and the reserve. Select the intended building before placing it.",
        },
        {
          title: "Place cold store and dispatch",
          action:
            "Place the cold store at B3 and the dispatch dock at B4. The food travels B1 → B2 → B3 → B4. Sketch a controlled transition from post-fry/freezing and packing into finished-product storage.",
          reason:
            "A short cold-chain handover limits exposure and reduces movements near dirty incoming traffic. Frozen product still requires a suitable hygienic handling design.",
          accept:
            "The four buildings form a continuous west-to-east chain. The dispatch face can be approached from vacant C4.",
          fix: "If the dock has no approach, check that its footprint is B4 and C4 remains open.",
        },
        {
          title: "Locate services and controls",
          action:
            "Place utilities at C2 and the control building at C3. Reserve D1 to D4 for the example yard route. Keep the dry electrical/control space separated from wet intake and wash activities.",
          reason:
            "The service building is next to the process hall, while a dedicated control room provides a cleaner environment for OT servers and operator access.",
          accept:
            "Six distinct footprints occupy B1, B2, B3, B4, C2 and C3. The gate at C1 remains clear.",
          fix: "If an apparently vacant road is blocked, check whether a misplaced building occupies a gate, dock apron or one of the D-row access cells.",
        },
        {
          title: "Construct each shell in sequence",
          action:
            "Open Construction and select one building. Choose the foundation package in the schedule and use Pour foundation. Choose the frame package and use Erect frame. Choose its shell finish and use Close shell. Repeat for all six buildings. On a physical project, qualified designers and contractors establish the ground design, structural loading, lifting plan, inspections and manufacturer details.",
          reason:
            "Foundations support the design loads, the frame carries the envelope, and the envelope controls access and the environment. Mechanical fitout depends on the room being ready to receive equipment.",
          accept:
            "Each of the six footprints has a foundation, an erected frame and a closed shell with the selected finish.",
          fix: "Read the individual building status. An unfinished predecessor or incorrect finish can keep the building open even when surrounding shells are complete.",
        },
        {
          title: "Inspect the envelope and drainage",
          action:
            "Use washable wet finishes for intake, hygienic sealed surfaces for process, an insulated vapour-tight envelope for cold store, a weather-sealed dock, ventilated industrial utilities and a dry filtered control room. Sketch wet-room falls, trapped drains, accessible clean-outs and a route to wastewater handling.",
          reason:
            "Sealed cleanable surfaces and appropriate drainage help prevent standing water and unintended transfer between dirty and cleaner areas. Vapour control supports the cold-store envelope.",
          accept:
            "The simulated finish schedule passes. For a design review, record cleaning access, service penetrations and where wash water and waste actually leave each zone.",
          fix: "A matching simulator finish does not prove drainage performance. Resolve dirty-water paths, cleaning access and air movement with the design team before physical acceptance.",
        },
      ],
      links: [
        {
          text: "Safe Work Australia · Safe design of structures",
          url: "https://www.safeworkaustralia.gov.au/doc/model-code-practice-safe-design-structures",
        },
        {
          text: "Food Standards Australia New Zealand · Safe Food Australia, Chapter 3.2.3",
          url: "https://www.foodstandards.gov.au/sites/default/files/2026-04/Safe-Food-Australia-4th-edition.pdf",
        },
      ],
    },
    {
      id: "utilities",
      title: "Route utilities and traffic",
      intro:
        "Trace each service between named endpoints, then test access to both loading faces. Keep source, destination and direction explicit on the drawing.",
      steps: [
        {
          title: "Bring process power and water to the hall",
          action:
            "In Utilities choose the power service, source utilities.power and destination process.power, then Connect service. Repeat with utilities.water → process.water. Label the field design with equipment loads, isolation ownership, required water quality and point of use.",
          reason:
            "Available power supports equipment operation. Water supply must suit washing and food-contact duties at the required flow. A line on a layout establishes connectivity only.",
          accept:
            "Both power and water connections are present in the route list with the required endpoints.",
          fix: "If a connection is refused, check the selected service type and the direction of the source and destination.",
        },
        {
          title: "Route refrigeration, data and finished product",
          action:
            "Connect utilities.chilled → cold.chilled, control.network → process.network and cold.product → dispatch.product. Trace each route through the buildings and identify where ongoing monitoring will detect loss of service.",
          reason:
            "Refrigeration supports cold storage. The network links field operation to control. The physical product path bridges cold store and dock. Each relationship has a distinct commissioning owner.",
          accept:
            "The three connections appear with distinct service types. The frozen product route terminates at dispatch.",
          fix: "If cold storage is installed but the route remains incomplete, distinguish the refrigeration supply from the cold.product transfer.",
        },
        {
          title: "Supply heat to the process and air to the actuators",
          action:
            "Select Process heat and connect utilities.heat → process.heat. Then select Instrument air and connect utilities.air → process.air. Follow each service from the utility building to its consumer in the process hall.",
          reason:
            "Blanching transfers heat into the water and product. Frying requires heat to maintain the oil bath as incoming strips release moisture. Pneumatic valves and gates need an air supply to respond to control commands.",
          accept:
            "The route list shows Process heat and Instrument air with their respective endpoints. On a physical project, the mechanical design establishes the heating medium, duty, air quality and capacity. Commissioning then verifies the agreed conditions at the points of use.",
          fix: "If the model rejects a connection, check that the selected service matches both terminal names. For a physical commissioning review, trace the heating supply to each exchanger and trace the air supply and position feedback for each actuator.",
        },
        {
          title: "Review wastewater and hygienic boundaries",
          action:
            "Select Wastewater and connect process.wastewater → utilities.treatment. Sketch wash-water collection, soil and stone screening, peel separation and the treatment inlet. Trace process effluent, stormwater and sanitary streams separately. Mark handwashing and change points at hygiene transitions.",
          reason:
            "A poorly placed drain or shared waste corridor can carry contamination back into product areas. Space for cleaning and waste removal must survive later equipment installation.",
          accept:
            "Eight distinct service connections appear. Process effluent reaches the treatment inlet. Treatment performance, capacity and discharge approval require separate engineering review for a physical project.",
          fix: "If discharge quality or the destination is unknown, record it as an open design item and obtain the relevant provider and authority requirements.",
        },
        {
          title: "Prove the two vehicle approaches",
          action:
            "In Road and docks use C1 for the site gate and receiving apron. Use C4 as the separate finished dispatch apron. Select Test vehicle routes. Follow the outbound path from C1 through D1, D2, D3 and D4 to C4 alongside B4.",
          reason:
            "The raw arrival can stop at the intake face. finished dispatch has its own final approach. In this worked design both routes share the external entrance, so actual vehicle scheduling and pedestrian segregation still need review.",
          accept:
            "The route test finds travel across unoccupied cells from the gate to both aprons, each beside its assigned building.",
          fix: "An apron painted beside the wrong building or a footprint blocking the vacant yard path can break connectivity. Recheck C1, C4 and the D-row cells.",
        },
      ],
      links: [
        {
          text: "Food Standards Australia New Zealand · Safe Food Australia, Chapter 3.2.3",
          url: "https://www.foodstandards.gov.au/sites/default/files/2026-04/Safe-Food-Australia-4th-edition.pdf",
        },
        {
          text: "Safe Work Australia · Safe design of structures",
          url: "https://www.safeworkaustralia.gov.au/doc/model-code-practice-safe-design-structures",
        },
        {
          text: "NIST · Guide to Operational Technology Security",
          url: "https://csrc.nist.gov/pubs/sp/800/82/r3/final",
        },
      ],
    },
    {
      id: "acceptance",
      title: "Accept the site before equipment fitout",
      intro:
        "The survey, six shells, service links and vehicle paths form the civil handover. Record the evidence for each dependency before introducing the batch.",
      steps: [
        {
          title: "Run the site acceptance checks",
          action:
            "In Acceptance choose Run acceptance tests. Inspect survey, layout, all six shells and finishes, service routes and vehicle access. Select Commission site when every dependency passes.",
          reason:
            "A building being visible on a drawing establishes its location. Acceptance also needs the required physical state, services and access.",
          accept:
            "The simulator shows a commissioned site. Handover evidence includes the layout, finish schedule, utility route list and access test result.",
          fix: "Open the named failing subsystem. After any correction, test it and rerun site acceptance before continuing.",
        },
        {
          title: "Plan the field walkdown",
          action:
            "Starting at receiving, walk the product path to dispatch with operations, quality, maintenance and IT/OT representatives. Identify cleaning access, drain destinations, cold-chain transitions, emergency routes and maintainable equipment clearances.",
          reason:
            "An assembly can satisfy a model but still create a difficult cleaning task or obstruct repair access. A walkdown tests the installed arrangement against practical work.",
          accept:
            "For each unresolved item, name a responsible person, due date, acceptance criterion and retest record. Any real handover depends on the appropriate specialists, inspections and approvals.",
          fix: "If as-built conditions differ from the drawing, capture the revision and re-evaluate affected utility and access paths.",
        },
      ],
      links: [
        {
          text: "NASA · Systems Engineering Handbook",
          url: "https://www.nasa.gov/reference/systems-engineering-handbook/",
        },
        {
          text: "Food Standards Australia New Zealand · Safe Food Australia, Chapter 3.2.3",
          url: "https://www.foodstandards.gov.au/sites/default/files/2026-04/Safe-Food-Australia-4th-edition.pdf",
        },
      ],
    },
    {
      id: "rack",
      title: "Fit the OT rack and host services",
      intro:
        "Move into the dry control building. Complete the cabinet and point-to-point patching before checking operating systems, network settings and applications.",
      steps: [
        {
          title: "Build the protected rack",
          action:
            "In Rack use the worked 12U elevation. Fit the UPS across U1–U2, compute host A at U3–U4, host B at U5–U6 and the managed switch at U9. In Patching connect UPS.OUT to PDU.IN. Connect PDU.1 to HOST-A.PWR, PDU.2 to HOST-B.PWR and PDU.3 to SW.PWR.",
          reason:
            "Locating the heavy UPS low in the rack improves the model arrangement. The single protected supply feeds hosts and switch, so loss of a single PDU remains a common failure.",
          accept:
            "The cabinet passes its overlap and size checks. Four power links form a continuous path to both hosts and the switch.",
          fix: "If a device is present but unavailable, trace the complete power chain, including the UPS-to-PDU connection.",
        },
        {
          title: "Patch data and control simulator I/O",
          action:
            "Connect SW.P1 to HOST-A.NIC, SW.P2 to HOST-B.NIC and SW.P3 to PLC.ETH. Pair DI.0 with SIM.START, DI.1 with SIM.GUARD, DI.2 with SIM.READY, and DO.0 with SIM.ENABLE. Trace the signal direction as you select each pair.",
          reason:
            "Each endpoint carries one defined function. The digital training signals provide the controller input conditions and a visible process-enable output.",
          accept:
            "The patch schedule contains all 11 distinct pairs, including the four power leads.",
          fix: "An occupied socket can already belong to an incorrect pair. Remove the incorrect lead and reconnect both scheduled endpoints.",
        },
        {
          title: "Install hypervisors and provision guests",
          action:
            "On both hosts install Hypervisor OS, create vOT and assign VLAN 20. On host A provision control at 10.42.20.21. On host B provision history at .22, execution at .23 and adapter at .24 using the same 10.42.20 prefix.",
          reason:
            "The virtual switch determines guest network attachment. Reserving addresses ties each service to a known endpoint and avoids duplicate addressing.",
          accept:
            "Every named guest is present on the intended host with a unique address.",
          fix: "If network endpoints exist but service checking fails, verify the host assignment, exact vOT name, VLAN and address on the guest.",
        },
        {
          title: "Bind applications to upstream systems",
          action:
            "On control install the SCADA server bound to plc.tags. On history install the historian bound to scada.tags. On execution install the MES application bound to historian.events. On adapter install the ERP adapter bound to mes.confirmed.",
          reason:
            "The binding determines which system supplies the data. A correctly booted guest can still read the wrong provider.",
          accept:
            "Trace a commissioning record from PLC through SCADA, historian, MES and the ERP adapter. Every binding matches the deployment schedule.",
          fix: "Begin at the first missing value. Verify that service’s VM assignment, provider and upstream dependency before changing downstream software.",
        },
      ],
      links: [
        {
          text: "NIST · Guide to Operational Technology Security",
          url: "https://csrc.nist.gov/pubs/sp/800/82/r3/final",
        },
        {
          text: "Microsoft Learn · Hyper-V checkpoints and recovery",
          url: "https://learn.microsoft.com/en-us/windows-server/virtualization/hyper-v/checkpoints",
        },
      ],
    },
    {
      id: "controls",
      title: "Program the PLC and operator system",
      intro:
        "Work through controller logic, tag engineering and screen behaviour in sequence. The enable logic is a simulated process permission. Functional safety requires its own qualified design and validation.",
      steps: [
        {
          title: "Fit and program the controller",
          action:
            "In PLC fit CPU-01 in slot 0, DI-8 in slot 1 and DO-8 in slot 2. Set 10.42.20.10. Enter RUN := START AND GUARD AND READY. then one transition per stage. For example, RECEIVE WHEN RUN -> WASH. and DISPATCH WHEN RUN -> DONE.. Link each intervening operation in recipe order. Compile and test.",
          reason:
            "A transition depends on both the command and process permissives. A program that advances correctly during normal running may still advance during a hold.",
          accept:
            "The compiled sequence passes all eight input combinations at all ten stages. Every disabled combination holds the stage.",
          fix: "Check the first assignment, semicolons, ASCII arrow, duplicate stages and missing transitions. Match the next operation to the physical process route.",
        },
        {
          title: "Map seven signals in SCADA",
          action:
            "Bind batch to MES.BatchId with MES.Quality (text, gain 1). Bind stage to PLC.Stage (text, 1), mass to PLC.Mass_g (kg, 0.001), progress to PLC.Progress_permille (%, 0.1), running to PLC.Run (bool, 1), and alarm to PLC.TripText (text, 1). Use PLC.Quality for these five tags. Bind stock to ERP.Stock_kg with ERP.Quality (kg, 1).",
          reason:
            "Source, quality and engineering conversion travel together. Grams mislabelled as kilograms produce a thousandfold display error.",
          accept:
            "The normal source sample 15,000 g reads 15 kg. A trip sample of 12,000 g reads 12 kg.",
          fix: "If the number is plausible but frozen, inspect source quality and time. If the error has a constant ratio, inspect the unit and multiplier.",
        },
        {
          title: "Test the historian and HMI",
          action:
            "Set alarm behaviour to trip-or-stale and historian behaviour to good-on-change. Run the provider tests. In HMI create a named screen with batch and stage text widgets, mass and stock numeric widgets, a progress bar, running lamp and alarm indicator. Give each widget a readable label.",
          reason:
            "An unchanged good sample and a stale sample have different meanings. An operator needs to see these differences when interpreting trends or responding to a trip.",
          accept:
            "The provider records a changed good value, suppresses duplicates and stale samples, and distinguishes a trip alarm from a quality alarm. The operator screen shows seven appropriately bound widgets.",
          fix: "Check that history is collecting the scaled good mass and that the stale test is excluded. Inspect tag source and widget type when one tile remains blank.",
        },
      ],
      links: [
        {
          text: "Siemens · cyclic organisation blocks",
          url: "https://docs.tia.siemens.cloud/r/en-us/v21/functional-description-of-s7-1200-cpus-s7-1200/organization-blocks-s7-1200/cyclic-obs-s7-1200",
        },
        {
          text: "Inductive Automation · tag history",
          url: "https://www.docs.inductiveautomation.com/docs/8.3/ignition-modules/tag-historian/configuring-tag-history",
        },
        {
          text: "NIST · Guide to Operational Technology Security",
          url: "https://csrc.nist.gov/pubs/sp/800/82/r3/final",
        },
      ],
    },
    {
      id: "systems",
      title: "Release the order and reconcile inventory",
      intro:
        "Connect the plant-floor operation to the order, material lot and final shipment. These are public SAP concepts implemented in a local training ledger.",
      steps: [
        {
          title: "Set the MES route",
          action:
            "Create recipe FRY-01. Append receive, wash, peel, cut, blanch, dry, fry, freeze, pack and dispatch in that order. Compare the route with the PLC transition list before releasing production.",
          reason:
            "The PLC controls the next physical movement. MES gives it business meaning. They must agree on which operation is being completed.",
          accept:
            "Every operation occurs once, in the same order as the line and the PLC program.",
          fix: "If the final route fails, look for a skipped or transposed stage. Undo the last operation and rebuild the incorrect suffix.",
        },
        {
          title: "Configure ERP posting semantics",
          action:
            "Map component issue to movement 261 and finished receipt to 101. Map yield to accepted material, scrap to rejected material, and the unique posting key to eventId. The example uses SAP production terminology. Actual posting configuration and automatic movements vary across installations.",
          reason:
            "A purchase or production receipt increases stock. a material issue consumes it. Distinct operation events within the same batch require different identities.",
          accept:
            "A repeat delivery of one event retains the original effect. A different event for that batch can still post.",
          fix: "If counts double, inspect replay identity and posted status. If later events disappear, check that batchId has not replaced eventId.",
        },
        {
          title: "Create and release the worked order",
          action:
            "Use Frozen straight-cut fries as the product, Cold store DC-02 as the destination and 700 kg as the planned yield. Receive 1,000 kg of raw lot POT-2601, record the order release and trace its batch identity into the first operation.",
          reason:
            "Planned yield expresses the order target. The raw receipt proves material availability, while the stage ledger accumulates actual amounts.",
          accept:
            "The order is released and the raw lot covers the selected charge. The inventory receipt appears once.",
          fix: "If the line cannot start, inspect order status, raw lot ID and available quantity before adjusting machine settings.",
        },
        {
          title: "Reconcile dispatch after packing",
          action:
            "After a completed run inspect each stage input, addition, removed stream and output. Compare accepted packed net mass with its finished receipt, reconcile any queued events through the adapter, then inspect the dispatch movement.",
          reason:
            "Water uptake and oil absorption add mass. Soil, peel, fines, evaporation and loose carryover leave the main product path. Net product can differ from both raw intake and planned yield.",
          accept:
            "Input + additions = output + removals for every operation. The shipment links back to the raw lot and the finished receipt has a single event identity.",
          fix: "If ERP is offline, keep the pending movement and inspect it after reconnection. Treat a missing acknowledgement as an unknown outcome until the event ledger is checked.",
        },
      ],
      links: [
        {
          text: "SAP Learning · processing production orders",
          url: "https://learning.sap.com/courses/executing-basic-erp-processes-with-sap-s-4hana/processing-production-orders",
        },
        {
          text: "NASA · Systems Engineering Handbook",
          url: "https://www.nasa.gov/reference/systems-engineering-handbook/",
        },
      ],
    },
    {
      id: "process",
      title: "Commission the ten process stations",
      intro:
        "At each bay choose the specified machine, mount it, and connect the sensor and actuator using the station drawing. Set the recipe value, inject the station fault, select the recovery action and verify it. The values below are fictional teaching settings.",
      steps: [
        {
          title: "Receiving",
          action:
            "Mount Metering hopper and weigh belt. Connect the field sensor JB01:S1 (belt scale load) to PLC-01:AI01. Connect PLC-01:AO01 to actuator JB01:A1 (feeder speed demand). Set feed rate to 100 kg/min.",
          reason:
            "A stable incoming rate keeps the washer fed without overflowing its inlet.",
          accept:
            "Inject “Belt scale quality lost”, select “Restore load-cell signal and verify zero” and verify recovery. Matched lot ID and feed rate within the training window. Whole potatoes cross the receiving scale. The model records no product loss here.",
          fix: "A missing weight signal must hold the feeder. Check that the lot identity and last valid mass record survive the hold.",
        },
        {
          title: "Washing",
          action:
            "Mount Rotary washer and stone separator. Connect the field sensor JB02:S1 (wash flow transmitter) to PLC-01:AI02. Connect PLC-01:AO02 to actuator JB02:A1 (wash pump speed). Set wash-water flow to 80 L/min.",
          reason:
            "Flow supplies washing action and carries loose soil to the separation stream.",
          accept:
            "Inject “Wash flow missing”, select “Restore flow feedback and confirm circulation” and verify recovery. Clean potato stream with debris counted separately. The soil and stones branch leaves the wet washing system separately. Recirculated water stays outside this product-mass boundary.",
          fix: "Hold upstream feed when flow feedback is missing. Check the circulation indication before releasing material.",
        },
        {
          title: "Peeling",
          action:
            "Mount Batch steam peeler and skin remover. Connect the field sensor JB03:S1 (vessel cycle complete) to PLC-01:DI03. Connect PLC-01:DO03 to actuator JB03:A1 (batch sequencer request). Set model exposure timer to 16 s.",
          reason:
            "The model couples exposure time to peel removal. Extending the cycle increases simulated trim loss.",
          accept:
            "Inject “Cycle completion absent”, select “Confirm completed batch and restore handshake” and verify recovery. A completed batch and a separate peel-loss record. The skin-removal branch collects loosened peel and trim.",
          fix: "Hold discharge until the completed-batch acknowledgement matches the outstanding request. Keep the batch ID open during the hold.",
        },
        {
          title: "Cutting",
          action:
            "Mount Hydraulic strip cutter and sliver sorter. Connect the field sensor JB04:S1 (cutter feed flow) to PLC-01:AI04. Connect PLC-01:DO04 to actuator JB04:A1 (product feed enable). Set installed cutter pitch to 10 mm.",
          reason:
            "This order calls for a 10 mm strip grid. Editing the recipe records a physical setup choice and cannot change the grid in metal.",
          accept:
            "Inject “Feed-flow proof lost”, select “Re-establish feed-flow proof” and verify recovery. 10 mm grid assigned and fines diverted from the accepted strips. A separate grading branch captures slivers and off-cuts.",
          fix: "Stop accepting potatoes into the cutting stream while flow proof is missing. Recover the proof before requesting feed.",
        },
        {
          title: "Blanching",
          action:
            "Mount Continuous water blancher. Connect the field sensor JB05:S1 (blancher belt encoder) to PLC-01:AI05. Connect PLC-01:AO05 to actuator JB05:A1 (blancher conveyor speed). Set model residence time to 90 s.",
          reason:
            "The residence timer determines exposure in the model. Compare measured travel time with the order recipe.",
          accept:
            "Inject “Belt encoder stale”, select “Restore encoder and verify travel time” and verify recovery. Verified residence time with water pickup and solids loss separately accounted. The material model includes absorbed water and soluble solids removed in blanch water.",
          fix: "Pause transfer on stale speed feedback. Time a simulated marker across the belt after recovery.",
        },
        {
          title: "Drying",
          action:
            "Mount Through-air belt dryer. Connect the field sensor JB06:S1 (outlet belt scale) to PLC-01:AI06. Connect PLC-01:AO06 to actuator JB06:A1 (circulation fan demand). Set model mass reduction to 6 %.",
          reason:
            "Removing surface water reduces the water load entering the fryer. A mass change alone cannot identify the product’s absolute moisture content.",
          accept:
            "Inject “Outlet scale signal invalid”, select “Restore outlet scale and match both batch intervals” and verify recovery. Measured model mass reduction inside the agreed training window. Water removed by the dryer exits as vapour.",
          fix: "Hold transfer when inlet and outlet masses cannot be compared over a common batch window.",
        },
        {
          title: "Par-frying",
          action:
            "Mount Continuous fryer and oil filter. Connect the field sensor JB07:S1 (fryer conveyor encoder) to PLC-01:AI07. Connect PLC-01:AO07 to actuator JB07:A1 (fryer belt speed demand). Set model belt residence to 45 s.",
          reason:
            "Residence changes the simulated balance of moisture evaporation and absorbed oil. This exercise does not specify an oil temperature or food release criterion.",
          accept:
            "Inject “Oil circulation permissive lost”, select “Restore circulation proof before feed” and verify recovery. Water loss and oil addition posted separately for the batch. The oil circuit recirculates. Only absorbed oil enters the product ledger; evaporated water leaves it.",
          fix: "The feed is held when the equipment reports unavailable circulation. The simulated permissive must return healthy before production resumes.",
        },
        {
          title: "Freezing",
          action:
            "Mount Fluidised-bed belt freezer. Connect the field sensor JB08:S1 (freezer return-air temperature) to PLC-01:AI08. Connect PLC-01:AO08 to actuator JB08:A1 (freezer belt speed demand). Set model cold-zone residence to 12 min.",
          reason:
            "Time in the model cold zone changes the predicted product condition. A return-air sensor measures the air at its location.",
          accept:
            "Inject “Return-air sample stale”, select “Restore fresh air measurement and confirm zone readiness” and verify recovery. Valid cold-zone reading and complete model residence interval. Freezing changes product condition; this simplified freezer assumes no product mass change.",
          fix: "A retained numerical value is insufficient after communications loss. Require fresh quality and time before releasing the batch.",
        },
        {
          title: "Packing",
          action:
            "Mount Multihead weigher and bagger. Connect the field sensor JB09:S1 (checkweigher net weight) to PLC-01:AI09. Connect PLC-01:DO09 to actuator JB09:A1 (bag discharge request). Set net bag target to 1000 g.",
          reason:
            "The example order requires 1,000 g bags. A partial bag stays as loose carryover outside the packed lot.",
          accept:
            "Inject “Checkweigher signal invalid”, select “Restore checkweight and verify a reference pack” and verify recovery. Complete bags reconciled against bulk input and loose carryover. Packaging film is outside the net-food mass balance.",
          fix: "Hold release without valid net weight. Verify the reference pack before accepting another bag.",
        },
        {
          title: "Dispatch",
          action:
            "Mount Pallet transfer and dock scanner. Connect the field sensor JB10:S1 (pallet ID scan valid) to PLC-01:DI10. Connect PLC-01:DO10 to actuator JB10:A1 (dock transfer release). Set dock lane assignment to 2 lane.",
          reason:
            "This training shipment is allocated to lane 2. A valid scan for another lane cannot release this order.",
          accept:
            "Inject “Pallet identity unreadable”, select “Rescan the matching pallet and confirm dock lane” and verify recovery. A matched shipment and one dispatch entry for the finished lot. No net product mass changes at dispatch. The movement changes inventory location and shipment status.",
          fix: "Keep the load in staging while its identity is unknown. Reconcile the order and pallet before authorising a dock transfer.",
        },
      ],
      links: [
        {
          text: "Heat and Control · French fry processing line",
          url: "https://www.heatandcontrol.com/solutions/french-fries-potato-co-products",
        },
        {
          text: "Food Standards Australia New Zealand · Safe Food Australia, Chapter 3.2.3",
          url: "https://www.foodstandards.gov.au/sites/default/files/2026-04/Safe-Food-Australia-4th-edition.pdf",
        },
      ],
    },
  ];

  const schedule = [
    [
      "Raw intake",
      "B1",
      "Washdown receiving slab",
      "Open unloading canopy",
      "Washable wet finish",
    ],
    [
      "Process hall",
      "B2",
      "Drained process floor",
      "Cleanable process frame",
      "Sealed hygienic finish",
    ],
    [
      "Cold store",
      "B3",
      "Insulated cold-store floor",
      "Cold-envelope support frame",
      "Insulated vapour-tight envelope",
    ],
    [
      "Dispatch",
      "B4",
      "Dock loading slab",
      "Clear-span dock frame",
      "Weather-sealed dock",
    ],
    [
      "Utilities",
      "C2",
      "Plant equipment base",
      "Service-access frame",
      "Ventilated industrial finish",
    ],
    [
      "Control and server room",
      "C3",
      "Dry equipment slab",
      "Enclosed services frame",
      "Dry filtered enclosure",
    ],
  ];

  function el(tag, text) {
    const result = document.createElement(tag);
    if (text !== undefined) result.textContent = text;
    return result;
  }

  function chapter(id) {
    return chapters.find((item) => item.id === id) || chapters[0];
  }

  function layoutTable() {
    const table = el("table");
    table.append(el("caption", "Worked building and envelope schedule"));
    const head = table.createTHead().insertRow();
    for (const name of [
      "Building",
      "Plot",
      "Foundation",
      "Frame",
      "Shell finish",
    ]) {
      const th = el("th", name);
      th.scope = "col";
      head.append(th);
    }
    const body = table.createTBody();
    for (const entry of schedule) {
      const row = body.insertRow();
      for (const text of entry) row.insertCell().textContent = text;
    }
    return table;
  }

  function mount(root, section = "plot") {
    if (!root) return;
    const current = chapter(section);
    const card = el("section");
    card.className = "sw-site-guide";
    const style = el(
      "style",
      `
      .sw-site-guide{color:#20362e;background:#f8faf5;border:1px solid #b7cbbf;border-radius:.6rem;padding:clamp(.8rem,2vw,1.4rem);font:inherit;min-width:0}
      .sw-site-guide h3,.sw-site-guide p,.sw-site-guide summary,.sw-site-guide dt,.sw-site-guide dd{color:#254236}
      .sw-site-guide h3{margin:1rem 0 .45rem;font-size:clamp(1.3rem,3vw,1.8rem);line-height:1.15}.sw-site-guide p{line-height:1.55}
      .sw-site-guide .sg-nav{display:flex;flex-wrap:wrap;align-items:end;gap:.5rem}.sw-site-guide label{display:grid;gap:.25rem;flex:1 1 12rem;color:#264433;font-weight:650}
      .sw-site-guide select,.sw-site-guide button{min-width:0;max-width:100%;font:inherit;background:#fff;color:#243f32;border:1px solid #789987;border-radius:.35rem;padding:.45rem .6rem}
      .sw-site-guide button,.sw-site-guide summary{cursor:pointer}.sw-site-guide button:disabled{opacity:.45;cursor:default}.sw-site-guide :focus-visible{outline:3px solid #365cc2;outline-offset:3px}
      .sw-site-guide details{padding:.7rem .8rem;border:1px solid #bacdbf;background:white;margin:.55rem 0;border-radius:.45rem}.sw-site-guide summary{font-weight:700}
      .sw-site-guide dl{margin:.6rem 0}.sw-site-guide dt{font-weight:700;margin:.55rem 0 .15rem}.sw-site-guide dd{margin:0;line-height:1.55}
      .sw-site-guide table{width:100%;border-collapse:collapse;margin:.65rem 0;font-size:.9rem}.sw-site-guide caption,.sw-site-guide th{text-align:left;font-weight:700}
      .sw-site-guide td,.sw-site-guide th{border-bottom:1px solid #cbd8ce;padding:.3rem;overflow-wrap:anywhere}.sw-site-guide a{color:#14583c;text-decoration:underline}.sw-site-guide .sg-footer{font-size:.9rem;background:#eaf1e5;padding:.65rem;border-radius:.4rem}
    `,
    );
    const nav = el("div");
    nav.className = "sg-nav";
    const label = el("label", "Field guide chapter");
    const select = el("select");
    select.setAttribute("aria-label", "Field guide chapter");
    for (const item of chapters) select.append(new Option(item.title, item.id));
    select.value = current.id;
    function switchTo(id) {
      mount(root, id);
      root.querySelector("select").focus({ preventScroll: true });
    }
    select.addEventListener("change", () => switchTo(select.value));
    label.append(select);
    nav.append(label);
    const position = chapters.indexOf(current);
    for (const [name, delta] of [
      ["Previous", -1],
      ["Next", 1],
    ]) {
      const button = el("button", name);
      button.type = "button";
      const target = chapters[position + delta];
      button.disabled = !target;
      if (target) button.addEventListener("click", () => switchTo(target.id));
      nav.append(button);
    }
    card.append(nav, el("h3", current.title), el("p", current.intro));
    if (current.id === "buildings") {
      const panel = el("div");
      panel.style.cssText = "overflow-x:auto;max-width:100%";
      panel.append(layoutTable());
      card.append(panel);
    }
    current.steps.forEach((step, i) => {
      const details = el("details");
      details.open = i === 0;
      details.append(el("summary", i + 1 + ". " + step.title));
      const evidence = el("dl");
      for (const [term, key] of [
        ["Action", "action"],
        ["Reason", "reason"],
        ["Acceptance evidence", "accept"],
        ["If the check fails", "fix"],
      ]) {
        evidence.append(el("dt", term), el("dd", step[key]));
      }
      details.append(evidence);
      card.append(details);
    });
    const footer = el("div");
    footer.className = "sg-footer";
    footer.append(
      el(
        "p",
        "The grid, endpoint names, process settings and acceptance thresholds are fictional exercise assumptions. Physical projects use approved civil, food-safety, electrical and refrigeration designs and specialist sign-off.",
      ),
    );
    const links = el("ul");
    for (const ref of current.links) {
      const a = el("a", ref.text);
      a.href = ref.url;
      const li = el("li");
      li.append(a);
      links.append(li);
    }
    footer.append(el("strong", "Primary references"), links);
    card.append(footer);
    root.replaceChildren(style, card);
  }

  window.SiteGuide = { mount, chapter };
})();
