# Catalogue: unresolved decisions

Generated from `packages/product-types/src/catalogue` by `npm run catalogue:report`. Do not edit by hand; a test fails if this file differs from the catalogue.

All non-ring dimensions are **proposed aesthetic presets for prototypes**, not approved sizes. Unknown requirements are `null` with an owner; none has been invented.

## Presets and what they may be used for

| Family | Presets | Implementation | Storefront | Prototype | Internal preview | Enquiry | Checkout | Manufacturing release |
|---|---:|---|---|---:|---:|---:|---:|---:|
| Ring | 6 | implemented | enquiry_only | 6 | 6 | 6 | 0 | 0 |
| Pendant | 15 | prototype, planned | hidden | 9 | 9 | 0 | 0 | 0 |
| Charm | 12 | planned | hidden | 0 | 0 | 0 | 0 | 0 |
| Stud earrings | 9 | planned | hidden | 0 | 0 | 0 | 0 | 0 |
| Drop earrings | 9 | planned | hidden | 0 | 0 | 0 | 0 | 0 |
| Chain bracelet | 12 | planned | hidden | 0 | 0 | 0 | 0 | 0 |
| Cuff / bangle | 1 | planned | hidden | 0 | 0 | 0 | 0 | 0 |
| Locket | 9 | planned | hidden | 0 | 0 | 0 | 0 | 0 |
| Cufflinks | 12 | planned | hidden | 0 | 0 | 0 | 0 | 0 |
| Brooch | 7 | planned | hidden | 0 | 0 | 0 | 0 | 0 |
| Lapel pin | 6 | planned | hidden | 0 | 0 | 0 | 0 | 0 |
| Tie slide | 3 | planned | hidden | 0 | 0 | 0 | 0 | 0 |

No preset is eligible for checkout or manufacturing release: those need manufacturing approval and every manufacturing requirement approved.

## À Vie (design decisions)

### Pendant

| Field | Needed | Presets |
|---|---|---:|
| `design.terrainWindow` | Area of the face available to the landscape (inside any border). | all |
| `design.borderWidthMm` | Depends on the chosen face treatment (terrain to edge or within a frame). | all |
| `design.borderHeightMm` | Depends on the chosen face treatment. | all |
| `design.reverseFinish` | Plain reverse finish (polished or satin). | all |
| `outline.cornerRadiusMm` | Corner radius not yet chosen for this cushion size. | 3 of 15 |
| `outline.cornerTreatment` | Corner treatment (square, chamfered or radiused) not yet chosen. | 3 of 15 |
| `outline.orientation` | Point-up or flat-up orientation not yet chosen. | 3 of 15 |

### Charm

| Field | Needed | Presets |
|---|---|---:|
| `design.terrainWindow` | Area of the face available to the landscape (inside any border). | all |
| `design.reverseEngravingArea` | Area available for reverse engraving. | all |
| `design.attachmentOrientation` | How the charm hangs. | all |
| `outline.cornerRadiusMm` | Corner radius not yet chosen for this cushion size. | 3 of 12 |
| `outline.cornerTreatment` | Corner treatment (square, chamfered or radiused) not yet chosen. | 3 of 12 |

### Stud earrings

| Field | Needed | Presets |
|---|---|---:|
| `design.postPosition` | Post position on the back, pending a balance review. | all |
| `design.postAxis` | Post direction relative to the face. | all |
| `outline.cornerRadiusMm` | Corner radius not yet chosen for this cushion size. | 3 of 9 |

### Drop earrings

| Field | Needed | Presets |
|---|---|---:|
| `design.overallDropMm` | Complete hanging length including findings. | all |
| `outline.cornerTreatment` | Corner treatment (square, chamfered or radiused) not yet chosen. | 3 of 9 |

### Chain bracelet

| Field | Needed | Presets |
|---|---|---:|
| `design.attachmentPoints` | Where the chain joins the element. | all |
| `design.reverseProfile` | Shape of the back against the wrist. | all |
| `design.centralElementCurvature` | Curvature of the element, if any. | all |
| `outline.cornerTreatment` | Corner treatment (square, chamfered or radiused) not yet chosen. | 3 of 12 |
| `outline.cornerRadiusMm` | Corner radius not yet chosen for this cushion size. | 3 of 12 |

### Cuff / bangle

| Field | Needed | Presets |
|---|---|---:|
| `outline.widthMm` | Terrain panel width. | all |
| `outline.heightMm` | Terrain panel height. | all |
| `outline.cornerRadiusMm` | Panel corner radius. | all |
| `design.innerMajorAxisMm` | Inner major axis. | all |
| `design.innerMinorAxisMm` | Inner minor axis. | all |
| `design.internalPerimeterMm` | Internal perimeter. | all |
| `design.bandWidthMm` | Band width. | all |
| `design.bandThicknessMm` | Band thickness. | all |
| `design.openingGapMm` | Opening gap (open cuffs). | all |
| `design.handEntryRequirement` | Hand-entry requirement (closed bangles); wrist size alone is not enough. | all |

### Locket

| Field | Needed | Presets |
|---|---|---:|
| `design.overallDepthMm` | Overall depth with both shells. | all |
| `design.compartmentDimensions` | Photo compartment size. | all |
| `outline.cornerRadiusMm` | Corner radius not yet chosen for this cushion size. | 3 of 9 |

### Cufflinks

| Field | Needed | Presets |
|---|---|---:|
| `design.stemPosition` | Stem position on the back. | all |
| `design.assemblyMethod` | How face and mechanism are joined. | all |
| `outline.cornerRadiusMm` | Corner radius not yet chosen for this cushion size. | 3 of 12 |
| `outline.cornerRadiusMm` | Corner radius not yet chosen. | 3 of 12 |

### Brooch

| Field | Needed | Presets |
|---|---|---:|
| `design.pinPosition` | Pin position. | all |
| `design.pinDirection` | Pin direction. | all |
| `design.garmentContactProfile` | Back profile against the garment. | all |
| `outline.cornerRadiusMm` | Corner radius not yet chosen. | 2 of 7 |

### Lapel pin

| Field | Needed | Presets |
|---|---|---:|
| `outline.cornerRadiusMm` | Corner radius not yet chosen for this cushion size. | 3 of 6 |

### Tie slide

| Field | Needed | Presets |
|---|---|---:|
| `outline.cornerRadiusMm` | Corner radius not yet chosen. | all |


## Manufacturer

### Ring

| Field | Needed | Presets |
|---|---|---:|
| `manufacturing.baseThicknessMm` | Body thickness below the terrain baseline, per alloy. | all |
| `manufacturing.maximumReliefMm` | Maximum terrain height above the baseline. | all |
| `manufacturing.minimumFeatureWidthMm` | Narrowest terrain feature that casts and survives finishing. | all |
| `manufacturing.minimumRimAngleDeg` | Sharpest edge allowed where terrain meets the body edge. | all |
| `manufacturing.minimumEdgeRadiusMm` | Smallest edge radius on the body. | all |
| `manufacturing.maximumFinishedMassG` | Finished-weight limit, if any. | all |
| `manufacturing.minimumStructuralWallMm` | Minimum metal between the outside and the finger, per alloy. | all |
| `manufacturing.sizingChartConfirmation` | Confirm the UK size chart against the maker's mandrels. | all |

### Pendant

| Field | Needed | Presets |
|---|---|---:|
| `manufacturing.baseThicknessMm` | Body thickness below the terrain baseline, per alloy. | all |
| `manufacturing.maximumReliefMm` | Maximum terrain height above the baseline. | all |
| `manufacturing.minimumFeatureWidthMm` | Narrowest terrain feature that casts and survives finishing. | all |
| `manufacturing.minimumRimAngleDeg` | Sharpest edge allowed where terrain meets the body edge. | all |
| `manufacturing.minimumEdgeRadiusMm` | Smallest edge radius on the body. | all |
| `manufacturing.maximumFinishedMassG` | Finished-weight limit, if any. | all |
| `manufacturing.bailWallThicknessMm` | Bail wall thickness. | all |
| `manufacturing.bailInternalWidthMm` | Bail opening width; must suit the chosen chain and its end fittings. | all |
| `manufacturing.bailInternalHeightMm` | Bail opening height; must suit the chosen chain and its end fittings. | all |
| `manufacturing.bailClearanceAllowanceMm` | Clearance between bail and chain. | all |
| `manufacturing.attachmentJunction` | How and where the bail joins the body. | all |
| `manufacturing.reverseEngravingDepthMm` | Reverse engraving depth. | all |

### Charm

| Field | Needed | Presets |
|---|---|---:|
| `manufacturing.baseThicknessMm` | Body thickness below the terrain baseline, per alloy. | all |
| `manufacturing.maximumReliefMm` | Maximum terrain height above the baseline. | all |
| `manufacturing.minimumFeatureWidthMm` | Narrowest terrain feature that casts and survives finishing. | all |
| `manufacturing.minimumRimAngleDeg` | Sharpest edge allowed where terrain meets the body edge. | all |
| `manufacturing.minimumEdgeRadiusMm` | Smallest edge radius on the body. | all |
| `manufacturing.maximumFinishedMassG` | Finished-weight limit, if any. | all |
| `manufacturing.loopDimensions` | Loop size and section. | all |
| `manufacturing.minimumAttachmentSectionMm` | Thinnest allowed section at the attachment. | all |
| `manufacturing.engravingDimensions` | Engraving size and depth. | all |

### Stud earrings

| Field | Needed | Presets |
|---|---|---:|
| `manufacturing.baseThicknessMm` | Body thickness below the terrain baseline, per alloy. | all |
| `manufacturing.maximumReliefMm` | Maximum terrain height above the baseline. | all |
| `manufacturing.minimumFeatureWidthMm` | Narrowest terrain feature that casts and survives finishing. | all |
| `manufacturing.minimumRimAngleDeg` | Sharpest edge allowed where terrain meets the body edge. | all |
| `manufacturing.minimumEdgeRadiusMm` | Smallest edge radius on the body. | all |
| `manufacturing.maximumFinishedMassG` | Finished-weight limit, if any. | all |
| `manufacturing.postAttachmentSpecification` | How the post is joined. | all |
| `manufacturing.maximumMassPerEarringG` | Comfortable maximum mass per ear. | all |

### Drop earrings

| Field | Needed | Presets |
|---|---|---:|
| `manufacturing.baseThicknessMm` | Body thickness below the terrain baseline, per alloy. | all |
| `manufacturing.maximumReliefMm` | Maximum terrain height above the baseline. | all |
| `manufacturing.minimumFeatureWidthMm` | Narrowest terrain feature that casts and survives finishing. | all |
| `manufacturing.minimumRimAngleDeg` | Sharpest edge allowed where terrain meets the body edge. | all |
| `manufacturing.minimumEdgeRadiusMm` | Smallest edge radius on the body. | all |
| `manufacturing.maximumFinishedMassG` | Finished-weight limit, if any. | all |
| `manufacturing.jointClearanceMm` | Clearance at moving joints. | all |
| `manufacturing.mechanicalAttachmentSpecification` | How the drop attaches. | all |
| `manufacturing.maximumMassPerEarringG` | Comfortable maximum mass per ear. | all |

### Chain bracelet

| Field | Needed | Presets |
|---|---|---:|
| `manufacturing.baseThicknessMm` | Body thickness below the terrain baseline, per alloy. | all |
| `manufacturing.maximumReliefMm` | Maximum terrain height above the baseline. | all |
| `manufacturing.minimumFeatureWidthMm` | Narrowest terrain feature that casts and survives finishing. | all |
| `manufacturing.minimumRimAngleDeg` | Sharpest edge allowed where terrain meets the body edge. | all |
| `manufacturing.minimumEdgeRadiusMm` | Smallest edge radius on the body. | all |
| `manufacturing.maximumFinishedMassG` | Finished-weight limit, if any. | all |
| `manufacturing.fitAllowanceMm` | Difference between wrist circumference and finished length. | all |
| `manufacturing.connectionStrength` | Connection strength requirement. | all |

### Cuff / bangle

| Field | Needed | Presets |
|---|---|---:|
| `manufacturing.baseThicknessMm` | Body thickness below the terrain baseline, per alloy. | all |
| `manufacturing.maximumReliefMm` | Maximum terrain height above the baseline. | all |
| `manufacturing.minimumFeatureWidthMm` | Narrowest terrain feature that casts and survives finishing. | all |
| `manufacturing.minimumRimAngleDeg` | Sharpest edge allowed where terrain meets the body edge. | all |
| `manufacturing.minimumEdgeRadiusMm` | Smallest edge radius on the body. | all |
| `manufacturing.maximumFinishedMassG` | Finished-weight limit, if any. | all |
| `manufacturing.sizingMethod` | Agreed sizing method. | all |

### Locket

| Field | Needed | Presets |
|---|---|---:|
| `manufacturing.baseThicknessMm` | Body thickness below the terrain baseline, per alloy. | all |
| `manufacturing.maximumReliefMm` | Maximum terrain height above the baseline. | all |
| `manufacturing.minimumFeatureWidthMm` | Narrowest terrain feature that casts and survives finishing. | all |
| `manufacturing.minimumRimAngleDeg` | Sharpest edge allowed where terrain meets the body edge. | all |
| `manufacturing.minimumEdgeRadiusMm` | Smallest edge radius on the body. | all |
| `manufacturing.maximumFinishedMassG` | Finished-weight limit, if any. | all |
| `manufacturing.shellThicknessMm` | Shell thickness. | all |
| `manufacturing.hingeDimensions` | Hinge and pin. | all |
| `manufacturing.closureEngagement` | Closure engagement and tolerances. | all |
| `manufacturing.openingAngleDeg` | Opening angle. | all |
| `manufacturing.photoInsertAllowanceMm` | Photo-insert allowance. | all |
| `manufacturing.assemblyClearancesMm` | Assembly clearances. | all |
| `components.frontShell` | Front shell (generated). | all |
| `components.rearShell` | Rear shell (generated). | all |

### Cufflinks

| Field | Needed | Presets |
|---|---|---:|
| `manufacturing.baseThicknessMm` | Body thickness below the terrain baseline, per alloy. | all |
| `manufacturing.maximumReliefMm` | Maximum terrain height above the baseline. | all |
| `manufacturing.minimumFeatureWidthMm` | Narrowest terrain feature that casts and survives finishing. | all |
| `manufacturing.minimumRimAngleDeg` | Sharpest edge allowed where terrain meets the body edge. | all |
| `manufacturing.minimumEdgeRadiusMm` | Smallest edge radius on the body. | all |
| `manufacturing.maximumFinishedMassG` | Finished-weight limit, if any. | all |
| `manufacturing.joiningSpecification` | Joining specification. | all |
| `manufacturing.mechanicalClearancesMm` | Mechanical clearances. | all |
| `manufacturing.totalMassPerCufflinkG` | Total mass per cufflink. | all |

### Brooch

| Field | Needed | Presets |
|---|---|---:|
| `manufacturing.baseThicknessMm` | Body thickness below the terrain baseline, per alloy. | all |
| `manufacturing.maximumReliefMm` | Maximum terrain height above the baseline. | all |
| `manufacturing.minimumFeatureWidthMm` | Narrowest terrain feature that casts and survives finishing. | all |
| `manufacturing.minimumRimAngleDeg` | Sharpest edge allowed where terrain meets the body edge. | all |
| `manufacturing.minimumEdgeRadiusMm` | Smallest edge radius on the body. | all |
| `manufacturing.maximumFinishedMassG` | Finished-weight limit, if any. | all |
| `manufacturing.mechanicalLimits` | Pin assembly mechanical limits. | all |

### Lapel pin

| Field | Needed | Presets |
|---|---|---:|
| `manufacturing.baseThicknessMm` | Body thickness below the terrain baseline, per alloy. | all |
| `manufacturing.maximumReliefMm` | Maximum terrain height above the baseline. | all |
| `manufacturing.minimumFeatureWidthMm` | Narrowest terrain feature that casts and survives finishing. | all |
| `manufacturing.minimumRimAngleDeg` | Sharpest edge allowed where terrain meets the body edge. | all |
| `manufacturing.minimumEdgeRadiusMm` | Smallest edge radius on the body. | all |
| `manufacturing.maximumFinishedMassG` | Finished-weight limit, if any. | all |

### Tie slide

| Field | Needed | Presets |
|---|---|---:|
| `manufacturing.baseThicknessMm` | Body thickness below the terrain baseline, per alloy. | all |
| `manufacturing.maximumReliefMm` | Maximum terrain height above the baseline. | all |
| `manufacturing.minimumFeatureWidthMm` | Narrowest terrain feature that casts and survives finishing. | all |
| `manufacturing.minimumRimAngleDeg` | Sharpest edge allowed where terrain meets the body edge. | all |
| `manufacturing.minimumEdgeRadiusMm` | Smallest edge radius on the body. | all |
| `manufacturing.maximumFinishedMassG` | Finished-weight limit, if any. | all |
| `manufacturing.clipMechanics` | Clip mechanics, working gap, material behaviour and grip. | all |


## Finding supplier or setter

### Pendant

| Field | Needed | Presets |
|---|---|---:|
| `components.chainSku` | Approved supplied chain; never generated procedurally. | all |

### Charm

| Field | Needed | Presets |
|---|---|---:|
| `components.attachmentFindingSku` | Approved clasp or loop finding. | all |
| `components.compatibleChainOrBraceletSku` | Chain or bracelet the charm is sold for. | all |
| `components.claspSpecification` | Clasp specification for removable charms. | all |

### Stud earrings

| Field | Needed | Presets |
|---|---|---:|
| `components.postFindingSku` | Approved post finding. | all |
| `components.backFindingSku` | Approved back finding. | all |
| `components.postDiameterMm` | From the approved post finding. | all |
| `components.postLengthMm` | From the approved post finding. | all |

### Drop earrings

| Field | Needed | Presets |
|---|---|---:|
| `components.findingSku` | Approved stud, hook or hoop finding. | all |
| `components.findingDimensions` | From the approved finding. | all |

### Chain bracelet

| Field | Needed | Presets |
|---|---|---:|
| `components.chainSku` | Approved bracelet chain. | all |
| `components.claspSku` | Approved clasp. | all |
| `components.linkDimensions` | From the approved chain. | all |

### Cuff / bangle

| Field | Needed | Presets |
|---|---|---:|
| `components.hingeAndClaspSku` | Hinge and clasp (hinged bangles). | all |

### Locket

| Field | Needed | Presets |
|---|---|---:|
| `components.hinge` | Hinge. | all |
| `components.hingePin` | Hinge pin. | all |
| `components.closure` | Closure. | all |
| `components.bail` | Bail. | all |
| `components.internalInsert` | Internal insert or photo frame. | all |

### Cufflinks

| Field | Needed | Presets |
|---|---|---:|
| `components.mechanismSupplierSku` | Manufacturer-selected mechanism; no invented swivel. | all |
| `components.stemLengthMm` | From the selected mechanism. | all |
| `components.backDimensions` | From the selected mechanism. | all |

### Brooch

| Field | Needed | Presets |
|---|---|---:|
| `components.pinAssemblySku` | Approved pin assembly. | all |
| `components.closureType` | Closure type. | all |
| `components.pinDimensions` | From the approved pin. | all |

### Lapel pin

| Field | Needed | Presets |
|---|---|---:|
| `components.pinFindingSku` | Approved pin finding. | all |

## Proposed and preview-only values

- 185 proposed values across 11 families (body dimensions and outline choices; the ring's sizing-table version). Proposed means a candidate for comparison, not approval.
- Preview-only values inside presets: none.
- Preview-only pendant style profiles (let the prototypes render; never production):
  - **Circle (hidden chain channel)** — profile `pendant-circle-preview-dev-1`, for pendant-round-petite, pendant-round-classic, pendant-round-statement. The chain passes through a hidden channel across the top of the disc.
    - `baseThicknessMm`: 2.6 — Disc thickness below the terrain baseline; holds the chain channel.
    - `maximumReliefMm`: 1.2 — Terrain at 100% height.
    - `edgeRoundMm`: 0.4 — Front and back edge rounds.
    - `terrainFadeMm`: 0 — Terrain runs to the edge.
    - `channelDiameterMm`: 1.6 — Chain channel diameter; must suit the chosen chain.
    - `channelFromTopMm`: 2.2 — Channel centre below the top edge.
    - `channelHeightMm`: 1.3 — Channel centre above the back.
  - **Circle with loop** — profile `pendant-preview-dev-1`, for pendant-round-petite, pendant-round-classic, pendant-round-statement. A round-section loop above the top edge, joined to the disc.
    - `baseThicknessMm`: 1 — Body below the terrain baseline.
    - `maximumReliefMm`: 1.5 — Terrain at 100% height.
    - `edgeRoundMm`: 0.3 — Front and back edge rounds.
    - `terrainFadeMm`: 1 — Band inside the edge round over which terrain eases to the plain face.
    - `loopOpeningHeightMm`: 3 — Integrated loop clear opening, vertical.
    - `loopOpeningDepthMm`: 2 — Integrated loop clear opening, front to back.
    - `loopWallMm`: 1 — Loop section diameter.
    - `loopEmbedMm`: 0.6 — How far the loop reaches into the rim. Visual overlap only; not a joint.
  - **Block (hidden chain channel)** — profile `pendant-block-preview-dev-1`, for pendant-tablet-petite, pendant-tablet-classic, pendant-tablet-statement. A solid block; the chain passes through a hidden channel across the top.
    - `baseThicknessMm`: 3.6 — Block thickness below the terrain baseline; holds the chain channel.
    - `maximumReliefMm`: 1.4 — Terrain at 100% height.
    - `edgeRoundMm`: 0.4 — Edge rounds.
    - `terrainFadeMm`: 0 — Terrain runs crisp to the edge.
    - `cornerRadiusMm`: 0.6 — Plan corner radius (the catalogue's corner treatment is undecided).
    - `channelDiameterMm`: 1.8 — Chain channel diameter; must suit the chosen chain.
    - `channelFromTopMm`: 2.2 — Channel centre below the top edge.
    - `channelHeightMm`: 1.8 — Channel centre above the back.
  - **Charm (folded tab)** — profile `pendant-charm-preview-dev-1`, for pendant-cushion-petite, pendant-cushion-classic, pendant-cushion-statement. A flat strap folded over the top edge, joined to the cushion.
    - `baseThicknessMm`: 1.6 — Body thickness below the terrain baseline.
    - `maximumReliefMm`: 1.4 — Terrain at 100% height.
    - `edgeRoundMm`: 0.5 — Edge rounds.
    - `terrainFadeMm`: 0 — Terrain runs to the edge.
    - `cornerRadiusRatio`: 0.22 — Cushion corner radius as a share of the smaller side (the catalogue's radius is undecided).
    - `tabWidthRatio`: 0.25 — Tab width as a share of the body width.
    - `tabThicknessMm`: 0.9 — Tab strap thickness.
    - `tabOpeningHeightMm`: 3 — Tab clear opening, vertical.
    - `tabOpeningDepthMm`: 2.4 — Tab clear opening, front to back.
    - `tabEmbedMm`: 1 — How far the tab reaches into the top edge.

## Gemstone treatments (all rejected until approved)

- Single accent diamond
- Single coloured gemstone
- Plain frame with one set stone
- Diamond-set surround
- Diamond stud with suspended terrain drop

Each needs, from the setter or manufacturer: `stoneType` (Stone type.); `stoneShape` (Stone shape.); `actualStoneDimensions` (Measured stone dimensions (not a marketing size such as '1 mm diamond').); `settingStyle` (Setting style.); `settingComponentOrGeometryId` (Setting component or approved geometry.); `seatDepthMm` (Seat depth.); `bearingGeometry` (Bearing geometry.); `prongDimensions` (Prong dimensions.); `bezelThicknessMm` (Bezel thickness.); `stoneClearancesMm` (Stone clearances.); `minimumMetalBelowSeatMm` (Minimum metal below the seat.); `settingSpacingMm` (Setting spacing.).

## Ring styles

- Rectangular / bar head: implemented
- Cushion head: implemented
- Round head: future
- Oval head: future
- Shield head: future
- Octagonal head: future
- Slim terrain band: future
- Wide terrain band: future

Signet heads are treated as future ring styles rather than a separate family; the `terrain_signet` registry entry stays until À Vie confirms.

## Coding-agent decisions (proposed in implementation, reviewed by À Vie)

- Outline generators (circle, ellipse, rounded rectangle, tablet, across-flats hexagon) and tessellation density, with dimensional-error tests.
- Landscape crop and mask for non-rectangular bodies: crop to the body's own aspect and mask; never stretch.
- Coordinate convention for flat products (right-handed, lying face-up): origin at the body centre on the back plane; +Y relief, +X right, attachment towards −Z; terrain north towards the attachment (see `catalogue/types.ts`).
- Preview-only edge radii and attachment proportions, listed as preview-only and blocked from release.

## Known conflicts to resolve

- The pendant compatibility window in `constraints.ts` (14–22 mm, from the earlier brief) rejects the proposed 12 mm petite oval, cushion and tablet sizes. À Vie decides the size range; the window is a candidate, not a manufacturing rule.
- The first pendant is now round 18 mm (this brief), replacing the earlier plan's cushion with an integrated loop.
- `terrain_object` (terrain sculpture on a base) is retired from the catalogue as outside fine jewellery; its registry and database entries remain so no record breaks.
- Stud earrings, drop earrings, brooches and lapel pins have no registry or database entry yet (`productId: null`); they are added when a family gets geometry.
