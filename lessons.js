window.tracks = [
  {
    id: "it",
    title: "Servers & infrastructure",
    summary:
      "Build the services a control room depends on, then prove you can recover them.",
    lessons: [
      {
        title: "Give a server a dependable identity",
        concept:
          "A host address identifies an interface. A subnet prefix decides which addresses the host treats as local; a default gateway handles destinations without a more specific route. DNS maps service names to addresses. Record all four before introducing an application.",
        example:
          "In a training subnet, the historian is 192.0.2.20/24, the gateway is 192.0.2.1 and the internal resolver is 192.0.2.53. Other hosts reach the historian by address, but its service name resolves to a retired address.",
        practice:
          "Write a baseline for the four fields. Compare the expected and returned DNS record, then the configured resolver. Keep the application and network tests separate.",
        question: "Which evidence explains the name-only failure?",
        choices: [
          "The gateway responds",
          "The returned address differs from the service address",
          "The historian has spare disk space",
        ],
        answer: 1,
        why: "The same service responds at its address. The differing DNS result isolates a naming discrepancy, not a disk problem.",
        source:
          "https://learn.microsoft.com/en-us/windows-server/networking/dns/dns-overview",
      },
      {
        title: "Give each service its own permissions",
        concept:
          "A service runs under an identity. Its right to start a process is different from its permission to open a database or write to a share. Give the application only the access required by its role.",
        example:
          "A collector starts after reboot and reads tags but cannot append measurements. Its log records a database permission denial. The reporting user can still read yesterday's totals.",
        practice:
          "Make an access matrix for collector, reporter and operator. Give the collector append access to measurements, the reporter read access and neither permission to administer the database.",
        question: "What should change first?",
        choices: [
          "Make the reporter an administrator",
          "Run all services as the same user",
          "Review the collector's database grant",
        ],
        answer: 2,
        why: "The failed action and identity identify the permission boundary. Changing machine-wide rights would not address the specific grant.",
        source:
          "https://learn.microsoft.com/windows-server/identity/ad-ds/manage/understand-service-accounts",
      },
      {
        title: "Put events on a common clock",
        concept:
          "Acquisition time describes when a signal was sampled. Arrival time describes when another system received it. A time service reduces clock differences; it does not remove network or buffering delays. Preserve both times when reconstructing incidents.",
        example:
          "A controller logs a stop at 10:00:03 and SCADA logs its request at 10:00:05. The controller clock was four seconds slow. On the reference clock the stop was at 10:00:07.",
        practice:
          "Draw both clocks on a timeline. Correct the controller timestamp, then describe what the sequence supports and why it does not alone prove causation.",
        question: "On the reference clock, when was the stop?",
        choices: ["10:00:07", "09:59:59", "10:00:03"],
        answer: 0,
        why: "Add four seconds to a clock reading four seconds behind. Record the offset evidence as well as the corrected time.",
        source:
          "https://learn.microsoft.com/en-us/windows-server/networking/windows-time-service/how-the-windows-time-service-works",
      },
      {
        title: "Prove a virtual server can recover",
        concept:
          "A virtual machine checkpoint helps reverse some local changes; it does not protect against loss of the storage holding the checkpoint chain. Recovery requires an independent copy, dependencies and a working application after restoration.",
        example:
          "A reporting VM boots in 12 minutes after restoration, but its database is unavailable for another 25. The recovery time objective is 30 minutes and the business test is a successful shift report.",
        practice:
          "Build a restore sequence for identity, database, service and test query. Record the restore-point time separately from time to service. Decide whether the trial passes.",
        question: "Did this trial meet its recovery time objective?",
        choices: [
          "Yes, the VM booted in 12 minutes",
          "No, reporting took at least 37 minutes",
          "Yes, a checkpoint exists",
        ],
        answer: 1,
        why: "Measure the business service, not just the guest operating system. Recovery point measures possible data loss, not outage duration.",
        source:
          "https://learn.microsoft.com/en-us/windows-server/virtualization/hyper-v/checkpoints",
      },
    ],
  },
  {
    id: "net",
    title: "Industrial networks",
    summary:
      "Trace a connection across switches, routed boundaries and application trust.",
    lessons: [
      {
        title: "Read the subnet before the route",
        concept:
          "On an ordinary IPv4 Ethernet subnet, the host sends local traffic directly using its neighbour table. Traffic for another subnet normally goes to a router. Two similar-looking addresses need not share a subnet.",
        example:
          "A /26 divides the final octet into blocks of 64. For 192.0.2.70/26 the network is .64 and broadcast is .127; usable hosts run from .65 to .126.",
        practice:
          "Place .65, .90 and .130 on a sketch. Identify which destination needs a router from .70 and whether a proposed gateway of .129 is on-link.",
        question: "Which destination is off-link for 192.0.2.70/26?",
        choices: ["192.0.2.90", "192.0.2.65", "192.0.2.130"],
        answer: 2,
        why: ".130 is in the next /26 block. The first three octets alone do not determine the network.",
        source:
          "https://learn.microsoft.com/en-us/troubleshoot/windows-client/networking/tcpip-addressing-and-subnetting",
      },
      {
        title: "Separate a VLAN from a security policy",
        concept:
          "A VLAN divides layer-two broadcast domains. A routed connection can still carry traffic between VLANs. Document required flows, then define which endpoints, directions and services may cross a boundary.",
        example:
          "A reporting service needs read-only production summaries. It does not need interactive access to controller programming interfaces. Putting the service on a new VLAN alone does not express that distinction.",
        practice:
          "Draw three zones: production, an integration zone and business reporting. Annotate which side initiates each connection and place an enforcement point between zones.",
        question: "What actually constrains the routed connection?",
        choices: [
          "An enforced traffic policy at the boundary",
          "The VLAN's descriptive name",
          "A different workstation wallpaper",
        ],
        answer: 0,
        why: "Segmentation creates a boundary; the enforced policy and application permissions determine what crosses it and what it may do.",
        source: "https://csrc.nist.gov/pubs/sp/800/82/r3/final",
      },
      {
        title: "Separate reachability from OPC UA trust",
        concept:
          "An address, route and listening endpoint provide a path. OPC Unified Architecture also identifies applications using certificates in common secure configurations. Application trust and the permissions of a session user answer different questions.",
        example:
          "An HMI reaches a replacement server. Its application certificate differs from the approved fingerprint, so the secure channel is rejected before any tag read.",
        practice:
          "Make a four-stage diagnostic record: name, path, application identity and user rights. Match the replacement fingerprint to independently approved commissioning evidence.",
        question: "Which observation belongs to application identity?",
        choices: [
          "A valid default route",
          "The verified certificate fingerprint",
          "A read grant on a temperature tag",
        ],
        answer: 1,
        why: "The certificate identifies the application. A route only establishes a path; tag permissions apply after authentication.",
        source: "https://reference.opcfoundation.org/specs/OPC-10000-2/4.10",
      },
      {
        title: "Design a support session you can audit",
        concept:
          "Remote maintenance should have a named owner, a defined destination, a limited access window and a record of activity. Time-limited access and least privilege reduce exposure without relying on network location alone.",
        example:
          "A supplier needs to review a drive fault report. An approved intermediary can expose the report without giving the supplier general access to the cell.",
        practice:
          "Write the task, duration, allowed destination, authentication method, session evidence and closing check. Specify who can revoke access if the task changes.",
        question:
          "Which record best demonstrates that the access window closed?",
        choices: [
          "A scheduled finish time",
          "A note that the supplier left",
          "Revocation evidence and a closed session record",
        ],
        answer: 2,
        why: "A planned expiry is intent. Confirming the actual account entitlement and session state establishes the outcome.",
        source: "https://csrc.nist.gov/pubs/sp/800/82/r3/final",
      },
    ],
  },
  {
    id: "plc",
    title: "PLC & instrumentation",
    summary:
      "Follow a physical measurement through the input image, logic and feedback.",
    lessons: [
      {
        title: "Scale an analogue input",
        concept:
          "A linear transmitter maps an engineering range onto a current span. Subtract the lower current before dividing by the span. Treat diagnostic status separately: an invalid signal is not automatically the minimum process value.",
        example:
          "A simulated 4 to 20 mA level signal represents 0 to 3 m. At 12 mA the measured fraction is (12 − 4) / 16 = 0.5, so the level is 1.5 m.",
        practice:
          "Make a calibration table for 4, 8, 12 and 20 mA. Add a broken-loop row with invalid quality instead of reporting an empty vessel.",
        question: "What level corresponds to 8 mA?",
        choices: ["0.75 m", "1.2 m", "2 m"],
        answer: 0,
        why: "8 mA is 4 mA above the live zero: one quarter of the span and one quarter of 3 m.",
        source:
          "https://www.analog.com/en/resources/analog-dialogue/articles/quad-16-bit-voltage-current-output-dacs.html",
      },
      {
        title: "Trace a cyclic task",
        concept:
          "A cyclic task observes its input data at discrete times. A physical change between observations is not automatically recorded. Input filtering, bus update time and controller scheduling all contribute to response.",
        example:
          "A model samples at 0, 10 and 20 ms. A sensor pulse starts at 2 ms and ends at 6 ms. With no latch, every sample reads low.",
        practice:
          "Sketch the trace. Move the pulse to 8 through 12 ms and compare. Name one hardware capture feature you would investigate before promising detection.",
        question: "What does the first trace prove?",
        choices: [
          "The sensor never pulsed",
          "A rising-edge instruction will recover the pulse",
          "A valid pulse can fall between observations",
        ],
        answer: 2,
        why: "Logic cannot detect a change that never entered its sampled input. Capture capability must match the required pulse width.",
        source:
          "https://infosys.beckhoff.com/content/1033/tcsystemmanager/1086469003.html",
      },
      {
        title: "Count transitions, not scan cycles",
        concept:
          "An edge detector compares the current Boolean input with stored history. A rising-edge pulse lasts one execution in the model; testing the level instead repeatedly counts an item that remains present.",
        example:
          "The input sequence for a simulated part sensor is false, true, true, true, false, true. With previous state false, two rising edges occur.",
        practice:
          "Tabulate current, previous and pulse for each scan. Repeat with one false sample inserted during a long true interval and explain why bouncing can overcount.",
        question:
          "What would a counter incrementing every true scan report in the original trace?",
        choices: ["Two", "Four", "One"],
        answer: 1,
        why: "Four samples are true but only two transitions are false-to-true. A level and a physical arrival are different events.",
        source:
          "https://content.helpme-codesys.com/en/libs/Standard/Current/index.html",
      },
      {
        title: "Separate command from confirmation",
        concept:
          "A device command records intent. Independent feedback records a response. A state machine makes the difference explicit: idle, starting, running or faulted. An on-delay timer can supervise a missing confirmation in a simulation.",
        example:
          "A virtual conveyor receives a run request. The model allows 2 s for running feedback. At 2.1 s the request is still active but confirmation has not arrived.",
        practice:
          "Write a transition table with current state, event and next state. Include a normal confirmation, a timeout and an intentional reset after the simulated fault clears.",
        question: "What state best represents the 2.1 s case?",
        choices: [
          "Starting indefinitely",
          "Running because the command is true",
          "Faulted with confirmation timeout",
        ],
        answer: 2,
        why: "A stale request is not evidence of motion. The timeout makes the discrepancy observable without claiming it identifies the physical cause.",
        source:
          "https://content.helpme-codesys.com/en/libs/Standard/Current/index.html",
      },
    ],
  },
  {
    id: "scada",
    title: "SCADA & historians",
    summary:
      "Make the operator display and the historical record tell the same defensible story.",
    lessons: [
      {
        title: "Read a tag as more than a value",
        concept:
          "A SCADA tag is a named point such as a measurement or state. The displayed value needs context: unit, timestamp, quality and source. A frozen good-looking value can mask lost communication.",
        example:
          "A simulated vessel shows 62% for a minute. One screen reports a current timestamp and good quality; another shows the previous minute and a communications fault.",
        practice:
          "Draft a faceplate that shows units, timestamp and status without relying on colour alone. Decide what a disconnected screen should show instead of a confident live reading.",
        question: "Which is stronger evidence of a current measurement?",
        choices: [
          "62% displayed to three decimals",
          "A current source timestamp and valid quality",
          "A green background alone",
        ],
        answer: 1,
        why: "Precision and styling do not establish freshness or validity. Inspect the tag's origin, time and quality together.",
        source: "https://docs.inductiveautomation.com/docs/8.3/platform/tags",
      },
      {
        title: "Build an actionable alarm",
        concept:
          "An alarm should demand a meaningful operator response. Keep alarm activation, return to normal and acknowledgement separate: acknowledgement tells you someone has seen the alarm, not that the process has recovered.",
        example:
          "On a simulated level trend, high level activates at 10:02, an operator acknowledges at 10:03 and the signal returns below the reset threshold at 10:08.",
        practice:
          "Write an operator instruction with cause, consequence, response and time available. Sketch three journal entries and identify when the abnormal condition actually ended.",
        question: "When did the condition clear in this example?",
        choices: ["10:08", "10:03", "10:02"],
        answer: 0,
        why: "The return-to-normal transition marks the end of the condition. Acknowledgement describes operator interaction.",
        source:
          "https://www.docs.inductiveautomation.com/docs/8.3/platform/alarming/alarm-journal",
      },
      {
        title: "Choose historian settings for the question",
        concept:
          "A historian archives selected observations. Sample frequency limits what it can see; a deadband can suppress small changes. A line drawn between stored points is not proof that the process followed that line.",
        example:
          "A one-second excursion occurs between two samples spaced five seconds apart. A trend viewer connects the two identical stored points into a flat line.",
        practice:
          "Draw a raw signal, its sample instants and the displayed trend. Specify the shortest event your investigation needs to resolve before choosing sample and storage settings.",
        question: "What can you conclude from this flat trend alone?",
        choices: [
          "No excursion occurred",
          "The sensor was definitely disconnected",
          "The recorded samples show no excursion",
        ],
        answer: 2,
        why: "Interpolation cannot reconstruct an unobserved event. Check capture settings and independent event records before excluding it.",
        source:
          "https://www.docs.inductiveautomation.com/docs/8.3/ignition-modules/tag-historian/configuring-tag-history",
      },
      {
        title: "Size a temporary data backlog",
        concept:
          "When a downstream database is unavailable, a store-and-forward queue can retain events for later delivery. Capacity must cover the outage and replay must drain faster than fresh arrivals to catch up.",
        example:
          "A simulated gateway receives 40 events/s for 15 minutes offline. It queues 36,000 events. On recovery the sink accepts 100 events/s while 40 events/s keep arriving.",
        practice:
          "Calculate backlog and drain time. Repeat for a sink accepting only 30 events/s. Specify a queue depth alarm and how you would verify the oldest delayed event arrived.",
        question:
          "At a sustained 100 events/s sink rate, how long to clear 36,000 queued events?",
        choices: ["6 minutes", "10 minutes", "15 minutes"],
        answer: 1,
        why: "Net drain is 100 − 40 = 60 events/s. 36,000 / 60 = 600 s, or 10 minutes, assuming constant rates.",
        source:
          "https://www.docs.inductiveautomation.com/docs/8.3/platform/alarming/alarm-journal",
      },
    ],
  },
  {
    id: "mes",
    title: "MES & production data",
    summary:
      "Turn machine events into trustworthy orders, genealogy and performance measures.",
    lessons: [
      {
        title: "Dispatch work to the right resource",
        concept:
          "A manufacturing execution system (MES) relates work to an order, operation and resource. A machine running is not enough to establish which order produced the output. Record which job was dispatched and accepted.",
        example:
          "A training cell can pack blue and green cartons. The queue contains two released jobs with different artwork. A run bit contains neither the product nor the approved operation.",
        practice:
          "Draft a dispatch record with order, operation, resource, product revision and quantity. Then write the evidence needed before attributing the first good carton to that job.",
        question: "Which item identifies the work actually selected?",
        choices: [
          "A recorded job acceptance linked to the resource",
          "The PLC run bit alone",
          "The first order alphabetically",
        ],
        answer: 0,
        why: "The acceptance binds a particular job to the resource. A machine status is not a work-order identifier.",
        source:
          "https://learn.microsoft.com/en-us/dynamics365/supply-chain/production-control/registration-manufacturing-execution",
      },
      {
        title: "Trace a lot in both directions",
        concept:
          "Lot genealogy records the transformation from consumed inputs to produced outputs. Forward trace finds which outputs used a suspect input. Backward trace identifies what went into one output.",
        example:
          "Input A goes into outputs X and Y. Input B goes only into Y. A quality hold is raised against A; a separate query asks which inputs went into Y.",
        practice:
          "Draw the directed graph A→X, A→Y and B→Y. List the forward scope of A and the backward scope of Y. Add quantity and unit to each consumption edge.",
        question: "Which outputs are candidates for a hold on input A?",
        choices: ["Y only", "X and Y", "A and B"],
        answer: 1,
        why: "Follow outgoing edges from the input. Narrowing a hold further requires additional trace evidence and the quality owner's decision.",
        source:
          "https://learn.microsoft.com/en-us/dynamics365/supply-chain/production-control/production-floor-execution-configure",
      },
      {
        title: "Decompose an OEE loss",
        concept:
          "Overall equipment effectiveness (OEE) combines availability, performance and first-pass quality. Fix the observation window, planned time and ideal cycle time before comparing shifts.",
        example:
          "A cell has 100 planned minutes, 80 running minutes, an ideal rate of 10 units/min, 720 total units and 684 first-pass good units. Availability is 0.80, performance 0.90 and quality 0.95.",
        practice:
          "Calculate each factor and their product. Cross-check by dividing good units by the 1,000 units that could be produced at the ideal rate across the planned window.",
        question: "What is OEE for this window?",
        choices: ["88.3%", "95.0%", "68.4%"],
        answer: 2,
        why: "0.80 × 0.90 × 0.95 = 0.684. Averaging the factors hides compounding losses.",
        source: "https://www.oee.com/calculating-oee/",
      },
      {
        title: "Distinguish a hold from scrap",
        concept:
          "Production quantity and quality disposition answer different questions. A held unit still exists. Until inspection resolves the hold, it is neither available good stock nor necessarily waste.",
        example:
          "A simulated lot contains 120 units: 108 released, 4 confirmed scrap and 8 held. An interface mistakenly reports 116 released by adding the held units to good stock.",
        practice:
          "Create a quantity ledger with mutually exclusive states. Move three held units to released after simulated approval and recalculate all three balances without changing the total.",
        question: "What are the balances after that approval?",
        choices: [
          "111 released, 4 scrap, 5 held",
          "116 released, 4 scrap, 0 held",
          "108 released, 7 scrap, 5 held",
        ],
        answer: 0,
        why: "Only the disposition of three units changed. The total of all balances remains 120.",
        source:
          "https://learn.microsoft.com/en-us/dynamics365/supply-chain/inventory/inventory-blocking",
      },
    ],
  },
  {
    id: "erp",
    title: "ERP & integration",
    summary:
      "Translate a production plan into material movements without losing or duplicating stock.",
    lessons: [
      {
        title: "Read a bill of materials and a routing",
        concept:
          "A bill of materials defines required components. A routing describes operations and resources. Product version and units matter: a correct number attached to the wrong unit changes the actual requirement.",
        example:
          "Each finished kit needs two brackets and four fasteners. A route allocates assembly followed by inspection. A released order calls for 75 kits with no allowance for scrap.",
        practice:
          "Explode the materials, then sketch the two operations separately. Explain which record would change if inspection moved to another resource but the design did not change.",
        question: "How many fasteners are required?",
        choices: ["150", "300", "75"],
        answer: 1,
        why: "Multiply 75 finished units by four fasteners per kit. The route does not change that quantity.",
        source:
          "https://learn.microsoft.com/en-us/dynamics365/supply-chain/production-control/bill-of-material-bom",
      },
      {
        title: "Keep planned and actual stock apart",
        concept:
          "A production order authorises work through a defined lifecycle. A planned quantity is demand, not proof that material was consumed or finished goods entered stock. Reconcile physical events with their authorised postings.",
        example:
          "An order requests 50 kits. The cell reports 45 accepted, three rejected and two unfinished. The planner still displays 50 as the ordered quantity.",
        practice:
          "Draw separate fields for planned, accepted, rejected and work in progress. Identify what must be confirmed before a receipt can be posted.",
        question: "Which quantity is supported as accepted finished output?",
        choices: ["50 kits", "48 kits", "45 kits"],
        answer: 2,
        why: "Only 45 have a recorded acceptance. Ordered, started and accepted quantities represent different stages.",
        source:
          "https://learn.microsoft.com/en-us/dynamics365/supply-chain/production-control/create-production-orders",
      },
      {
        title: "Reconcile component consumption",
        concept:
          "Backflushing posts a standard component quantity from a production event. Actual issue records what was physically consumed. If both post the same material movement, recorded inventory can fall twice.",
        example:
          "Ten kits require two clips each. A manual journal issues 20 clips. The finish event also backflushes 20, but the bin count fell by only 20.",
        practice:
          "Compare expected, physically issued and posted consumption. Identify the duplicate source and specify which business event should own this posting before correcting records.",
        question: "How large is the overstatement of consumption?",
        choices: ["20 clips", "40 clips", "10 clips"],
        answer: 0,
        why: "Two 20-clip postings record 40 against a single 20-clip physical issue. Use a controlled correction rather than concealing the variance.",
        source:
          "https://learn.microsoft.com/en-us/dynamics365/supply-chain/production-control/production-parameters-manufacturing-execution",
      },
      {
        title: "Handle an uncertain acknowledgement",
        concept:
          "A timeout tells the sender it did not receive acknowledgement. The receiver may already have committed the transaction. A stable event identity and an idempotent receiver let a retry converge on one business effect.",
        example:
          "The MES sends completion C17 for 24 units. ERP records it, but the reply is lost. A retry with a new event identity looks like another completion.",
        practice:
          "Sketch an event ledger keyed by source and event ID. Record the ledger key and inventory effect in one transaction. Test a duplicate delivery and a legitimate second completion with a different ID.",
        question: "What should happen when C17 is delivered twice?",
        choices: [
          "Replace the event ID on the retry",
          "One posting, with the existing outcome returned on replay",
          "Two postings followed by a manual estimate",
        ],
        answer: 1,
        why: "The same business event must not add inventory twice. A second genuine event needs its own independently assigned identity.",
        source:
          "https://learn.microsoft.com/en-us/azure/service-bus-messaging/service-bus-message-loss-and-duplicates",
      },
    ],
  },
  {
    id: "robot",
    title: "Robotics & motion",
    summary:
      "Reason about coordinates, reachability and the contract between robot and cell controller.",
    lessons: [
      {
        title: "Locate a pick in the correct frame",
        concept:
          "A coordinate has meaning only relative to its reference frame. Transform the part pose from the camera or fixture frame into the robot base frame before evaluating a pick. Rotation matters as well as translation.",
        example:
          "In a simple top-down model the fixture origin is at base coordinates (400, 100) mm and both axes align. A part is at (50, 20) mm in the fixture, so its base position is (450, 120) mm.",
        practice:
          "Now rotate the fixture 90° anticlockwise about its origin. Transform its local offset to (−20, 50) mm before adding the origin. Compare the two targets.",
        question: "Where is the part after rotating the fixture?",
        choices: ["(450, 120) mm", "(420, 150) mm", "(380, 150) mm"],
        answer: 2,
        why: "Apply the orientation to the local offset before adding the translation. Simply adding the unrotated offset is only valid for aligned frames.",
        source:
          "https://moveit.picknik.ai/main/api/html/planning_scene_overview.html",
      },
      {
        title: "Separate reachability from a valid path",
        concept:
          "Inverse kinematics seeks a joint configuration for a target pose. That configuration may violate limits or the path to it may collide. Collision geometry should include the carried part, not just the empty tool.",
        example:
          "An empty gripper clears a fixture in a model. A wide carton attached to the gripper intersects the fixture along the same return path even though both endpoint poses are reachable.",
        practice:
          "Sketch start, pick and place poses. Draw the payload envelope through the return path and list which scene objects and joint limits the planner must represent.",
        question: "Which test is missing from an endpoint-only reach check?",
        choices: [
          "Collision checking along the path with the attached part",
          "A second label for the target",
          "A new order number",
        ],
        answer: 0,
        why: "Endpoint solvability gives no guarantee of collision-free travel between poses. A model is also not a physical safety validation.",
        source:
          "https://moveit.picknik.ai/main/api/html/planning_scene_overview.html",
      },
      {
        title: "Budget a pick-and-place cycle",
        concept:
          "Cycle time is the elapsed time between successive outputs. Sequential steps add. Parallel branches join at the slower branch; reducing a shorter parallel activity may make no difference to throughput.",
        example:
          "A model spends 2 s approaching, 1 s gripping, 3 s transferring and 1 s releasing. It then returns for 2 s while inspection runs for 3 s. The next cycle waits for both.",
        practice:
          "Draw a timing chart. Compute total cycle time and ideal hourly capacity without downtime, then model inspection reduced to 1 s.",
        question: "What is the original cycle time?",
        choices: ["12 s", "10 s", "8 s"],
        answer: 1,
        why: "The first four steps total 7 s. The parallel tail lasts max(2, 3) = 3 s. Ideal capacity is 360 cycles/h.",
        source: "https://www.lean.org/lexicon-terms/cycle-time/",
      },
      {
        title: "Design a restartable cell handshake",
        concept:
          "A controller request, robot acceptance and robot completion represent different events. Give each job an identity and track its state. If communication fails after a pick, a repeated request must not silently execute another pick.",
        example:
          "For simulated job 42, the robot has picked the part but the controller missed the result. The last known application state is accepted, not confirmed complete.",
        practice:
          "Draw idle, accepted, in progress, completed and outcome-unknown states. Specify how job identity, part presence and retained result are reconciled before resuming.",
        question: "What is the best first action after reconnection?",
        choices: [
          "Issue a fresh pick immediately",
          "Mark the job complete from the timeout",
          "Reconcile job 42 and its simulated cell state",
        ],
        answer: 2,
        why: "The missing response does not prove the action failed. Resolve the physical and application state before choosing the next transition.",
        source:
          "https://learn.microsoft.com/en-us/azure/service-bus-messaging/service-bus-message-loss-and-duplicates",
      },
    ],
  },
  {
    id: "systems",
    title: "Systems & commissioning",
    summary:
      "Tie stakeholder needs to acceptance evidence and prove an entire simulated production order.",
    lessons: [
      {
        title: "Turn an opinion into a testable requirement",
        concept:
          "A requirement should identify the operating condition, observable result and pass threshold. Validation asks if it serves the user's need; verification asks whether the specified behaviour was delivered.",
        example:
          "A supervisor says the display must update quickly. In this training case the agreed criterion is that at least 99 of 100 accepted simulated state changes appear within 2 s under a specified load.",
        practice:
          "Write a test protocol defining the event source, display observation, clocks and calculation. Add a user walk-through to assess whether the threshold actually supports the task.",
        question: "Which result verifies the stated training criterion?",
        choices: [
          "A supplier says the screen is fast",
          "99 of 100 observed updates meet the 2 s limit at the stated load",
          "A single update arrives in 0.1 s",
        ],
        answer: 1,
        why: "The result covers the threshold, sample size and operating condition. A single good result is not representative evidence for the requirement.",
        source: "https://www.nasa.gov/reference/systems-engineering-handbook/",
      },
      {
        title: "Write an interface contract",
        concept:
          "An interface contract defines producer, consumer, semantics, units, identifier, timing and failure behaviour. A value that both parties can parse can still mean two different things.",
        example:
          "A transmitter reports 0.65 as a fraction of full scale, while the dashboard assumes the number is already a percentage and displays 0.65%. The transport is healthy.",
        practice:
          "Specify the field name, type, unit and allowed range. Write one normal test for 0.65, one boundary test for 1.0 and one rejected input for 1.2.",
        question: "What display follows the fraction-based contract for 0.65?",
        choices: ["65%", "0.65%", "6.5%"],
        answer: 0,
        why: "The fraction is multiplied by 100 for percentage display. Document which component owns that conversion to avoid applying it twice.",
        source: "https://www.nasa.gov/reference/systems-engineering-handbook/",
      },
      {
        title: "Distinguish factory and site acceptance",
        concept:
          "A factory acceptance test (FAT) can establish supplier configuration and simulated interface behaviour. A site acceptance test (SAT) addresses installed wiring, dependencies and integration conditions that the factory setup could not represent.",
        example:
          "A simulated sensor transition passed at FAT. After installation the field signal is mapped to a different channel. The factory record cannot establish point-to-point correspondence on site.",
        practice:
          "Draft one FAT test and one SAT test for an input-to-display path. Include expected tag, physical identifier, evidence, witness, limits and the retest rule after a discrepancy.",
        question: "Which claim requires site evidence?",
        choices: [
          "The simulated tag changed during FAT",
          "The factory test document exists",
          "The installed sensor corresponds to the intended operator display",
        ],
        answer: 2,
        why: "An installed-endpoint claim requires evidence from that installed path under the site's approved commissioning procedure.",
        source: "https://www.nasa.gov/reference/systems-engineering-handbook/",
      },
      {
        title: "Capstone: reconcile a complete order",
        concept:
          "Trace one order from the ERP release through MES dispatch, PLC sequence, robot completion, SCADA observation and inventory posting. Keep a shared order reference without confusing order, part and event identities.",
        example:
          "Order T24 requests 24 kits. The cell attempts 24: 22 pass and two are rejected. The network fails after ERP commits the 22-unit receipt but before its acknowledgement reaches MES.",
        practice:
          "Build a one-page evidence pack: interface map, signal timeline, lot genealogy, reject ledger, ERP receipt and replay result. Reconcile 24 = 22 + 2. Add a second scenario with lost tag quality and explain what remains unknown.",
        question: "What would demonstrate a passing end-to-end replay?",
        choices: [
          "A green network indicator",
          "One 22-unit receipt, two recorded rejects and a traceable repeat acknowledgement",
          "A second 22-unit receipt for the retried event",
        ],
        answer: 1,
        why: "The reconciled counts and stable event identity prove the business effect for this case. A working connection alone does not demonstrate correct production accounting.",
        source: "https://www.nasa.gov/reference/systems-engineering-handbook/",
      },
    ],
  },
];
