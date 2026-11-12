# Terra production output architecture

Status: proposed architecture, 12 November 2026. Exporters and paid-order automation are not implemented. Current app is a browser prototype with indexed triangle geometry and a quote placeholder, no verified paid-order backend.

## Decisions

Primary requirement: 3DM and binary STL. First package also includes production PDF/JSON, validation JSON, three PNG views, design snapshot, exact elevation input, and SHA-256 manifest. Optional OBJ and 3MF are mesh-compatible additions. GLB is a separate customer preview. STEP/IGES require a suitable CAD representation and independent verification; do not advertise them as supported until implemented. Native SolidWorks and Apple AR are outside the first release.

3DM initially contains the exact final manufacturing mesh, in millimetres, with named layers and version metadata. Use McNeel rhino3dm on a worker; no desktop Rhino installation required for this file-writing path. It does not turn a mesh into editable NURBS or generate CAD history. Confirm maker acceptance first. If they require NURBS/hybrid, develop an analytic/B-rep blank and a reviewed terrain representation as a separate workstream. Do not convert each triangle to a planar CAD face and describe it as an editable smooth solid.

Only actual construction geometry belongs on reference layers. The current generator does not produce separate blank, terrain and shoulder B-reps; do not fabricate these layers as claimed editable CAD surfaces. Hide non-printing references and export only the final shell to STL.

## Package

order-{internalOrderRef}/line-{lineId}/revision-{n}/
- manufacturer/terra-final.3dm
- manufacturer/terra-final.stl
- manufacturer/production-spec.pdf
- manufacturer/production-spec.json
- manufacturer/validation.json
- manufacturer/views/front.png, side.png, three-quarter.png
- manifest.json (file path, bytes, MIME, SHA-256)
- private-source/design.json, heightmap.bin, heightmap.json
- customer/preview.glb (separate access policy)

Keep raw terrain/source and internal diagnostics private by default. Manufacturer receives only necessary job data and an internal reference, not customer contact/payment data. A ZIP is a delivery convenience; immutable storage objects and manifest remain authoritative. Manifest lists payload hashes, not its own hash; store manifest hash externally if required.

## Frozen design

Save on design approval, before checkout: schema version, product, geometry engine version/build commit, all resolved geometry parameters including constraints, size system/label and exact opening diameter, alloy/density estimate provenance, finish, exact terrain samples/encoding/dimensions, coordinate reference and geographic extent/rotation, source attribution, relief/detail/smoothing, explicit engraving status, approval timestamp and source hash. Never refetch terrain to reproduce an existing order. Never use adaptive low-detail preview geometry for manufacture.

Canonical design hash covers deterministic ordered values and exact terrain bytes; excludes order ID and timestamps. Record final mesh hash separately. PDF/ZIP timestamps may vary; file-byte hashes still identify each issued revision. Paid-order references an immutable snapshot ID/hash; never trust browser-supplied price, payment state or arbitrary geometry.

## Worker and release flow

1. Authenticated commerce event accepted by the backend; verify signature, shop, actual paid state and line-item snapshot references. Handle event retries idempotently.
2. Persist event and enqueue durable job keyed by order + line item + approved design revision + manufacturer profile version. Quantity creates tracked units, not duplicate conflicting jobs.
3. Freeze approved manufacturing profile, regenerate deterministic high-resolution mesh from saved samples and pinned engine, independently validate.
4. Generate all required files in staging, reopen STL and 3DM using readers and compare dimensions, volume, triangle count and topology to canonical mesh. Generate specs and matching views from the same revision.
5. Hash each file, verify required profile completeness, publish atomically. Never present partial folder as ready.
6. Mark awaiting_review unless approved production rules and complete checks permit release. Maker confirms first sample; record approver, time, profile and artifact hashes.
7. Send only a released package through an authorised delivery flow. Store receipt/version. Cancellation blocks unreleased work; refunds and later changes require explicit operations handling. A size or terrain change creates a new revision; never overwrite an issued package.

Suggested statuses: queued, generating, validation_failed, export_failed, awaiting_review, released, superseded, cancelled. Missing size/approval/profile is awaiting_input. Preserve failures and diagnostics privately; retries cannot silently alter geometry.

## Validation

Required before release: finite coordinates and valid indices, no degenerate/duplicate faces, welded edge manifoldness and orientation, vertex manifoldness, single connected intended shell, outward orientation, no self-intersections, global wall/feature thickness, opening tolerance, footprint/relief limits, positive volume and plausible mass, file round-trip dimensions and topology, unit/orientation consistency, required files/checksums. Existing closure and radial-clearance tests are insufficient to prove all these.

Each check has pass/fail/not_run, method/version, measured values and profile thresholds. Unknown is never pass. Unsupported engraving is explicitly absent, not silently represented by text notes as if cut. No automatic structural repair or shrink compensation. Any approved repair produces a new mesh/revision with comparison evidence and reapproval.

STL is unitless: numeric coordinates use mm and PDF/JSON explicitly instruct mm, 1:1 finished nominal dimensions. 3DM declares mm. GLB uses metres with an explicit 0.001 conversion from mm; verify dimensions when converting. State current generator axes (X across head ends/shoulders, Y up toward terrain, Z across face width), and record any print-orientation transform explicitly. Printer supports/sprues/orientation, alloy shrinkage and polishing allowances belong to the maker profile, with approval; never guess universal values.

Do not claim a 0.01 mm chord error from fixed tessellation. Establish adaptive sampling/convergence against the procedural surface and measure deviation. Exporting an existing triangle mesh cannot restore lost terrain detail.

## Manufacturer profile

Versioned profile includes accepted 3DM version and representation (mesh/NURBS/hybrid), required/optional formats, alloy/process, units, size tolerance, wall/feature/relief constraints, measured tessellation deviation target, allowed file size, compensation responsibility, sprue/support responsibility, engraving method, finish instructions, QC and release sign-off. Unknown values block release, not prototype file generation marked REVIEW ONLY.

First questions: mesh-based 3DM acceptable? Rhino version? Finished nominal geometry or compensated pattern? Who adds supports/sprues? Alloy-specific wall/feature thresholds and polishing allowance? Preferred STL limits and size tolerance? First sample acceptance procedure?

## Implementation sequence

1. Snapshot schema, immutable storage and deterministic mesh reconstruction; fixture replay tests.
2. Binary STL + mesh 3DM worker exports, metadata and reopen tests. Generate one REVIEW ONLY package for maker acceptance, not automatic fulfilment.
3. Independent mesh validation and manufacturer-approved thresholds; production spec PDF/JSON, QC/views and checksum manifest. Validate PDF visually.
4. Partner acceptance with an opened file in their software and a physical sample; record compatibility by software/version.
5. Commerce event adapter, durable retries, access controls and release workflow. Then enable paid-order automation.
6. Optional 3MF/OBJ and customer GLB. Investigate true CAD/STEP only for an identified partner need.

## Primary references

- McNeel rhino3dm: https://www.rhino3d.com/features/developer/rhino3dm/
- Rhino STEP: https://docs.mcneel.com/rhino/8/help/en-us/fileio/step_stp_import_export.htm
- Autodesk STL/3MF: https://help.autodesk.com/view/fusion360/ENU/?contextId=MAKE-3D-PRINT-CMD
- 3MF Consortium specification: https://3mf.io/spec/
