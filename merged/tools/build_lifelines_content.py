"""Authored concepts + transparent deterministic expansions. Python 3, no packages."""
import json
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
def slug(s):
    return s.lower().replace("'", "").replace(" ", "-")
ERAS = [
('hearth','Hearth and settlement','A small place becomes a lasting home.'),
('fields','Fields and reserves','A harvest matters most when the next one fails.'),
('towns','Towns and coordination','More people need more than more food.'),
('networks','Connected regions','Distance becomes a problem people can solve.'),
('workshops','Workshops and institutions','Knowledge becomes a public resource.'),
('industry','Industrial systems','Power changes the scale of every decision.'),
('electric','Electric cities','Connections bring both reach and dependence.'),
('planetary','Planetary stewardship','A lasting future requires systems that repair themselves.')]
# Each row is a separately named programme concept; era placement is a game tier,
# NOT a claim about a date or unique historical origin.
CONCEPTS = {
'food': '''Gathering rounds|Share the work of finding seasonal food|Small yields require regular attention
Seed garden|Maintain a modest cultivated patch|Land is committed before the return arrives
Mixed fields|Spread effort across several food sources|Peak yield is lower than specialization
Raised beds|Keep root zones above occasional standing water|Construction consumes useful material
Orchard commons|Maintain a shared long-lived food source|Young trees delay the full benefit
Terrace programme|Create usable growing steps on slopes|Terraces need continued maintenance
Crop rotation council|Coordinate successive uses of cultivated land|Farmers must agree on a shared schedule
Regional grain reserve|Pool food beyond individual households|Transport and storage both matter
Mechanized cooperative|Share machinery across producers|Energy becomes an additional dependency
Cold chain|Keep food in a controlled distribution system|Power loss threatens a concentrated network
Urban growing network|Use varied urban spaces for food production|Space and skilled attention are limited
Circular food system|Recover useful material across food production|Coordination costs persist even at maturity''',
'water': '''Water carrying rota|Distribute trips to the nearest water source|Travel consumes household effort
Rain jars|Capture rain near homes|Supply varies with the weather
Protected well|Organize a maintained collection point|One source can become a bottleneck
Irrigation channels|Guide water toward productive land|Channels require clearing and repair
Cistern network|Distribute reserve storage through the settlement|Storage does not create new water
Gravity distribution|Use terrain to support water movement|Some districts are difficult to reach
Watershed council|Coordinate land and water decisions upstream|Benefits depend on cooperation beyond one district
Public pump network|Provide shared mechanical lifting points|Pumps need parts and maintenance
Treatment works|Run a managed water treatment service|Reliable operation needs energy and trained workers
Leak detection programme|Find losses before expanding extraction|Inspection competes with visible new construction
Water reuse network|Match recovered water to suitable uses|Separate uses need careful management
Adaptive water grid|Balance several sources and reserves|Complexity creates a training burden''',
'materials': '''Shared tool cache|Pool reusable tools near working households|A missing tool affects several workers
Timber stewardship|Plan harvest and regrowth together|Immediate extraction is deliberately limited
Clay workshop|Organize a repeatable local material process|Fuel and transport must be coordinated
Masonry yard|Prepare reusable building units|Heavy products are expensive to move
Repair quarter|Keep tools and buildings useful for longer|Maintenance is less visually dramatic than expansion
Metalworking guild|Coordinate skilled workshops and material supply|Specialist output depends on several inputs
Standard parts store|Keep compatible components available|Standardization constrains some custom designs
Regional salvage depot|Collect useful material from retired structures|Sorting requires sustained work
Machine workshop|Produce and maintain precision equipment|Power and skill shortages slow the whole chain
Recycling network|Recover sorted material for further use|Contaminated streams reduce useful output
Design for repair|Make future maintenance easier at construction time|Upfront work rises before savings appear
Circular materials exchange|Match one district's surplus with another's need|Transport and shared standards remain necessary''',
'energy': '''Fuel gathering rota|Share the work of collecting usable fuel|Heavy use can exhaust nearby supply
Efficient hearths|Improve the organization of shared heating|Benefits require correct operation
Charcoal yard|Coordinate a managed fuel-processing activity|Material use creates an ecological tradeoff
Waterwheel works|Use suitable flowing water for mechanical work|Flow varies and siting is constrained
Windmill commons|Share a mechanical system driven by wind|Output is variable
Managed woodland fuel|Connect fuel demand with a renewal plan|Regrowth limits rapid expansion
Steam service yard|Concentrate machinery operation and maintenance|Fuel and water supply become critical
District power station|Supply several districts from one plant|A central failure has broad consequences
Electric distribution|Connect generation and useful demand|Transmission needs upkeep and protection
Distributed renewables|Spread generation across many sites|Variable supply still needs balancing
Storage cooperative|Shift usable energy between times of need|Storage has costs and finite capacity
Flexible microgrids|Let districts coordinate and isolate when needed|Control systems and maintenance become more demanding''',
'knowledge': '''Story circle|Share practical observations between households|Memory changes when people leave
Apprentice rota|Pair experienced workers with learners|Training reduces short-term output
Marking house|Keep simple shared records|A record is useful only when people can interpret it
Public archive|Maintain a common place for stored knowledge|Concentrated records need protection
Learning courtyard|Make regular instruction accessible|Teachers need time and support
Translation workshop|Help knowledge cross language boundaries|Interpretation requires context
Printing cooperative|Reproduce useful instructions at greater scale|Distribution matters as much as production
Survey office|Coordinate observation before major projects|Measurement takes effort before benefits appear
Technical institute|Train people for interdependent systems|Specialization can create narrow understanding
Public library network|Distribute access to maintained information|Access remains unequal without active support
Open research exchange|Share methods and findings across institutions|Quality review needs sustained attention
Resilient knowledge mesh|Keep useful records in several accessible forms|Redundancy uses resources that appear idle''',
'health': '''Clean camp rota|Coordinate everyday upkeep around homes|Someone must keep doing the work
Waste separation|Keep different waste streams apart|Collection routes need organization
Drainage programme|Reduce persistent standing waste water|Maintenance is easy to postpone
Bathing commons|Support shared facilities for personal cleanliness|Water and upkeep must be budgeted
Care house|Provide a stable place for community care|Staffing cannot be replaced by an empty building
Sanitation board|Coordinate shared sanitation responsibilities|Rules need trust and practical access
Public health records|Observe patterns in community needs|Records need context and privacy
Local care network|Distribute basic services across districts|Coverage is harder in distant areas
Laboratory service|Support organized investigation of community problems|Equipment depends on energy and skills
Preventive care programme|Invest in problems before they grow|The benefits are less visible than emergency response
Accessible care routes|Make existing services easier to reach|Transport and information must both work
Resilient care system|Keep backup capacity for service disruption|Reserve capacity has an ongoing cost''',
'shelter': '''Shelter circle|Share basic protection from weather|Limited space needs collective decisions
Raised floors|Separate living areas from damp ground|Extra material is needed at construction
Roof repair rota|Maintain existing protection before expanding|Repair competes with new housing
Courtyard housing|Arrange homes around shared services|Shared spaces require agreements
Firebreak lanes|Leave planned access between structures|Valuable space remains unbuilt
Drainable streets|Coordinate buildings with runoff routes|Benefits depend on maintenance beyond one home
Building inspection|Find weaknesses before they become emergencies|Inspections take specialist effort
Shared housing fund|Support maintenance across households|Allocation requires transparent decisions
Serviced neighborhoods|Build housing together with essential networks|Large programmes need coordinated timing
Insulation retrofit|Improve existing envelopes|Work temporarily disrupts occupants
Flexible public space|Let buildings serve several community needs|Scheduling and stewardship are essential
Adaptive housing network|Plan homes for changing needs and conditions|Long-term flexibility adds initial cost''',
'logistics': '''Footpath crew|Maintain connections between common destinations|Distance still limits what can be moved
Landing place|Organize a safe shared transfer point|Its usefulness depends on the nearby network
Pack route station|Support repeated overland movement|Animals and handlers require continued care
Bridge programme|Connect districts across obstacles|A single crossing may become a bottleneck
Market square|Concentrate exchanges in an accessible place|Congestion grows with success
Wayfinding network|Make routes legible to newcomers|Signs need consistent upkeep
Canal freight system|Link suitable places with managed waterways|Water levels and maintenance affect service
Regional road service|Maintain a connected overland network|Distributed wear is costly to inspect
Rail interchange|Coordinate high-capacity movement between routes|Timetables and transfers must align
Integrated transit|Connect local movement across districts|Useful coverage needs more than one busy route
Repairable supply network|Plan alternate suppliers and routes|Redundancy costs more than a single cheap path
Adaptive freight exchange|Coordinate loads and spare capacity|Information failures can spread quickly''',
'ecology': '''Harvest boundary|Leave part of the local resource base undisturbed|Short-term extraction is limited
Stream buffer|Keep a protected strip beside water|Some productive land is set aside
Soil cover programme|Keep vulnerable ground covered|Planning continues between harvests
Community woodland|Maintain a shared living resource|Returns arrive over long periods
Erosion watch|Observe and repair vulnerable slopes|Work happens before a dramatic failure
Wetland stewardship|Coordinate care of wetland areas|Some development opportunities are forgone
Urban tree network|Support living cover through settled areas|Trees need room and ongoing care
Restoration nursery|Grow materials for landscape repair|Restoration takes time after planting
Pollution monitoring|Make otherwise hidden pressures visible|Information helps only when people respond
Watershed restoration|Repair connected ecological functions|Benefits cross administrative boundaries
Habitat corridor network|Connect separated living areas|Continuity requires cooperation across land uses
Circular landscape plan|Coordinate settlement demand with renewal|There is no single permanent optimum''',
'trust': '''Open council|Make shared decisions visible to households|Deliberation takes time
Shared store rules|Explain access to common reserves|Exceptions must be handled fairly
Mediation circle|Resolve disputes before they interrupt work|Mediators need legitimacy
Public ledger|Show how shared resources are used|Numbers without explanation can mislead
Neighborhood stewards|Keep local needs visible in wider decisions|Responsibilities must remain accountable
Common works charter|Define who maintains shared infrastructure|Agreements need revision as the town grows
Transparent procurement|Make project choices and costs inspectable|Review adds work before construction
Participatory budget|Give residents a role in allocating effort|Conflicting needs cannot all be met immediately
Independent inspection|Separate verification from project delivery|Oversight requires its own capacity
Accessible services desk|Help residents navigate public systems|Staffing must keep pace with demand
Shared crisis planning|Agree on priorities before disruption|Plans require rehearsal and revision
Federated civic network|Coordinate local autonomy and shared obligations|Negotiation remains necessary at every scale''',
'culture': '''Shared hearth stories|Create time for collective memory|Gathering uses time that could produce goods
Season gathering|Mark changes in community life together|Celebrations need preparation
Craft teaching circle|Share forms and techniques through practice|Skilled participants need support
Public performance court|Make room for shared artistic activity|Space needs stewardship
Local history collection|Preserve records of ordinary lives|Interpretation must welcome multiple voices
Traveling storytellers|Exchange accounts between settlements|Travel creates logistical demands
Community printing room|Support locally produced expression|Materials and access require management
Public arts workshop|Share tools for making cultural work|Tools need upkeep and safe access
Neighborhood cultural center|Support regular community activity|Programming matters more than the building alone
Accessible media studio|Let more residents create and share work|Technical access requires instruction
Living heritage exchange|Support traditions as changing practices|No institution can define everyone's identity
Distributed cultural archive|Keep many community voices accessible|Preservation needs consent and ongoing care''',
'resilience': '''Reserve basket|Keep a modest buffer for disruption|Reserved goods are unavailable for immediate use
Backup meeting point|Agree where to coordinate if a place is inaccessible|The plan needs to be known
Spare tools programme|Keep replacements for essential work|Spare capacity consumes material
Watch and repair rota|Observe infrastructure before failures spread|Routine attention competes with new projects
Distributed stores|Keep reserves in several places|More sites require more coordination
Mutual aid compact|Agree how districts support each other|Partners must maintain their own capacity
Emergency route plan|Prepare alternate ways to move supplies|Alternatives need maintenance even when unused
Redundant workshops|Avoid dependence on one specialist facility|Duplicated capability appears costly in calm periods
Reserve power service|Maintain energy support for essential functions|Testing and stored resources require upkeep
Continuity drills|Practice how to keep services operating|Rehearsal temporarily interrupts normal work
Cross-trained teams|Let workers cover more than one critical role|Training uses effort before a disruption
Adaptive recovery network|Coordinate repair priorities across systems|Complex recovery demands clear information'''
}
BIOMES = [
('river','River terraces','water',1.18,'shelter',0.9,'High water interrupts low crossings.','Waterline cyan / warm silt amber'),
('delta','Braided delta','food',1.16,'logistics',0.85,'Channels separate productive islands.','Deep teal / reed green / clay gold'),
('coast','Windward coast','logistics',1.18,'shelter',0.85,'Storms expose concentrated waterfront services.','Indigo / sea glass / lantern amber'),
('upland','Terraced upland','resilience',1.12,'water',0.85,'Slope and distance complicate distribution.','Slate blue / copper / sage'),
('dryland','Seasonal dryland','energy',1.18,'water',0.75,'Water must last between uncertain arrivals.','Ochre / midnight violet / turquoise'),
('woodland','Forest edge','materials',1.18,'food',0.9,'Expansion competes with living cover.','Pine green / honey / mist gray'),
('grassland','Open grassland','food',1.18,'materials',0.8,'Long routes connect widely spaced resources.','Golden grass / cobalt / rust'),
('island','Outer island','culture',1.12,'materials',0.75,'Resupply depends on a narrow set of routes.','Ultramarine / coral / pale sand'),
('cold','Cold valley','trust',1.12,'energy',0.75,'Seasonal demand makes reserves valuable.','Ice blue / ember / blue gray'),
('lake','Lake basin','water',1.18,'ecology',0.9,'Shared water links upstream and downstream choices.','Cobalt / moss / silver'),
('crossroads','Inland crossroads','knowledge',1.18,'health',0.9,'Rapid exchange increases coordination needs.','Violet / sandstone / brass'),
('urban','Dense urban basin','logistics',1.18,'ecology',0.75,'Many people depend on compact networks.','Charcoal / electric cyan / warm windows')]
CHAPTERS = [
('first-light','First Light',0,'food','river','Households arrive with tools, seeds and a little reserve. Organize a reliable food programme before asking the settlement to grow.','Do not confuse an immediate surplus with a dependable system.'),
('short-walk','The Shorter Walk',0,'water','dryland','Water is close enough to see but far enough to consume every morning. Reduce the dependence on carrying alone.','A small distribution improvement can release effort elsewhere.'),
('shared-roof','A Shared Roof',0,'shelter','cold','A change in weather exposes how unevenly protection is distributed. Repair the common shelter system.','Maintaining existing capacity can matter more than adding monuments.'),
('second-harvest','The Second Harvest',1,'food','grassland','A good harvest has encouraged new commitments. Create a food system that remains useful after the celebration.','Judge a reserve by the gap it can bridge.'),
('mud-and-memory','Mud and Memory',1,'knowledge','delta','Shared work is growing beyond what any one household remembers. Establish records without losing practical teaching.','Knowledge needs people who can use it.'),
('upstream','Upstream',1,'ecology','lake','Clearing one district changes what arrives downstream. Give the watershed a visible place in the settlement plan.','Local success can export a cost to someone else.'),
('many-mouths','Many Mouths',2,'health','crossroads','A larger settlement produces new service demands. Expand shared care and upkeep before shortages spread.','A building without a functioning service is not coverage.'),
('across-water','Across the Water',2,'logistics','river','Two useful districts are separated by an unreliable crossing. Organize a connection that supports both.','A network is constrained by its weakest shared link.'),
('fair-share','A Fair Share',2,'trust','upland','Several neighborhoods disagree about the next common project. Make allocation visible and keep participation practical.','Trust is supported by understandable choices and delivered work.'),
('distant-fields','Distant Fields',3,'logistics','grassland','Productive land lies beyond the busiest paths. Connect transport investment to a reserve rather than expanding either alone.','Distance changes the value of local production.'),
('stored-rain','Stored Rain',3,'water','island','Rain arrives in bursts. Organize a water service that remains useful after the sky clears.','Storage and supply solve different parts of a shortage.'),
('many-voices','Many Voices',3,'culture','coast','Travel brings new accounts and practices. Support shared cultural space while maintaining the services that make access possible.','Exchange requires both expression and access.'),
('workshop-street','Workshop Street',4,'materials','woodland','Workshops grow faster than their repair arrangements. Invest in useful material throughput without exhausting every reserve.','Repair changes demand as well as supply.'),
('readable-world','A Readable World',4,'knowledge','crossroads','More instructions circulate than the community can teach. Build access, interpretation and practical learning together.','Copying information is only one part of knowledge transfer.'),
('quiet-backup','The Quiet Backup',4,'resilience','upland','A successful network has become dependent on one route and a few specialists. Prepare useful alternatives before disruption.','Idle capacity can be a deliberate public choice.'),
('power-and-price','Power and Its Price',5,'energy','urban','New machinery expands what the settlement can produce. Keep its dependencies visible while creating reliable power.','Every concentrated advantage can become a concentrated vulnerability.'),
('homes-between','Homes Between Workshops',5,'shelter','river','Workplaces expand into the spaces between homes. Coordinate housing improvements with the networks residents actually use.','Settlement growth is more than output growth.'),
('hidden-cost','The Hidden Cost',5,'ecology','lake','Material throughput rises while the living landscape weakens. Make repair part of the operating system.','A cost that is not counted does not disappear.'),
('city-current','A City of Current',6,'energy','coast','A growing set of services depends on electricity. Strengthen supply while preserving a way to recover from interruptions.','Efficiency and continuity are different design goals.'),
('care-within-reach','Care Within Reach',6,'health','urban','Service capacity exists but is unevenly accessible. Make coverage work across the whole settlement.','Averages can conceal places left behind.'),
('open-ledger','The Open Ledger',6,'trust','crossroads','Decisions affect more people than a single council can know personally. Build inspectable institutions and feedback.','Information becomes useful when people can act on it.'),
('closing-loops','Closing Loops',7,'materials','island','Imports remain possible but increasingly fragile. Recover value locally and keep essential systems operating.','Circularity changes flows; it does not remove every dependency.'),
('living-network','The Living Network',7,'ecology','delta','Densely connected districts share one changing landscape. Restore living systems alongside built infrastructure.','Boundaries on a map do not isolate environmental effects.'),
('after-us','After Us',7,'resilience','cold','The settlement works today. Leave enough capability, knowledge and reserve for people facing conditions you cannot predict.','The final achievement is a system others can maintain.')]
POLICY_STYLES = [
('priority','Focused effort',5,{'materials':2},'Concentrate available effort here; other work receives fewer materials.'),
('cooperative','Shared stewardship',3,{'trust':1},'Use a shared programme with modest output and a coordination cost.'),
('training','Training investment',4,{'knowledge':2},'Trade present knowledge capacity for better delivery in this service.'),
('reserve','Reserve discipline',2,{},'Accept a smaller steady improvement with no additional stock upkeep.')]
EVENTS = {
'food': [('late-harvest','Late harvest','Several productive plots will deliver later than expected.'),('store-loss','Damaged stores','A reserve building needs repairs before its contents can be relied on.'),('new-growers','New growers','Experienced growers offer to organize another shared patch.'),('market-gap','Market gap','A familiar external source is temporarily unavailable.')],
'water':[('dry-channel','Dry channel','A local channel carries less than expected.'),('silted-intake','Silted intake','An intake needs a coordinated clearing effort.'),('shared-source','Shared source','Two districts propose an agreement for a common supply.'),('leaking-line','Leaking line','Inspection finds avoidable losses in the distribution system.')],
'materials':[('worn-tools','Worn tools','Several work crews need replacement parts at once.'),('salvage-find','Salvage opportunity','A retired structure contains useful recoverable material.'),('delivery-delay','Delivery delay','A planned material shipment is late.'),('repair-request','Repair requests','Maintenance work has accumulated across several sites.')],
'energy':[('fuel-gap','Fuel gap','The usual fuel delivery cannot cover all planned work.'),('power-window','Power window','Available power could support an additional shared activity.'),('worn-drive','Worn machinery','A drive system needs attention before its output falls.'),('peak-demand','Peak demand','Several important services need power simultaneously.')],
'knowledge':[('teacher-away','Teacher away','A key instructor is unavailable this season.'),('archive-move','Archive move','Records must move while their usual space is repaired.'),('new-method','New method','A workshop proposes a technique worth evaluating.'),('lost-context','Lost context','A useful record lacks the explanation needed to apply it.')],
'health':[('care-backlog','Care backlog','Shared services cannot meet every request at once.'),('cleaning-gap','Upkeep gap','A routine maintenance rota has lost participants.'),('service-outreach','Service outreach','A distant district asks for a regular service visit.'),('staff-training','Staff training','Staff request time to improve shared procedures.')],
'shelter':[('roof-damage','Roof damage','Weather exposes a set of overdue repairs.'),('crowded-court','Crowded courtyard','Several households need additional shared space.'),('empty-building','Unused building','A vacant structure could support public needs after repair.'),('street-runoff','Street runoff','Water is collecting where homes meet a common route.')],
'logistics':[('crossing-closed','Crossing closed','A crossing needs repair before normal loads can return.'),('route-conflict','Route conflict','Several services compete for the same narrow transfer point.'),('new-link','New link','Two districts propose a useful alternate connection.'),('vehicle-repair','Transport repair','A shared transport service needs spare capacity.')],
'ecology':[('bare-slope','Bare slope','Exposed ground is losing its protective cover.'),('buffer-request','Buffer request','Residents propose setting aside a strip near the water.'),('stressed-cover','Stressed living cover','A heavily used district needs ecological maintenance.'),('restoration-window','Restoration window','Conditions are favorable for a coordinated repair programme.')],
'trust':[('ledger-question','Ledger question','Residents ask how a shared project used its resources.'),('district-dispute','District dispute','Two neighborhoods disagree about a maintenance priority.'),('volunteer-offer','Volunteer offer','Residents offer effort if responsibilities are clear.'),('unclear-rule','Unclear rule','A common store rule is interpreted differently across districts.')],
'culture':[('gathering-space','Gathering space','A regular gathering has lost access to its usual site.'),('visiting-makers','Visiting makers','Visitors offer to share a useful creative practice.'),('fragile-record','Fragile record','A local collection needs care and contextual notes.'),('access-request','Access request','Residents ask for cultural activities closer to their homes.')],
'resilience':[('backup-unready','Backup unready','A planned reserve cannot yet support its intended service.'),('practice-day','Practice day','Crews ask to rehearse a coordinated recovery.'),('single-expert','Single expert','One specialist is carrying too much critical knowledge.'),('spare-inspection','Spare inspection','An inspection finds that spare equipment needs maintenance.')]
}
def build():
    sectors=list(CONCEPTS)
    resources=[{'id':s,'name':s.title(),'unit':'abstract service units','capacity':160,'historicalClaim':False} for s in sectors]
    projects=[]
    for si,(sector,rows) in enumerate(CONCEPTS.items()):
        for i,row in enumerate(rows.splitlines()):
            name,purpose,tradeoff=row.split('|'); era=i*8//12
            prev=projects[-1] if i else None
            projects.append({'id':slug(name),'name':name,'sector':sector,'era':era,'purpose':purpose,'tradeoff':tradeoff,
                'cost':{'materials':10+era*3+(i%3)*2,'knowledge':4+era*2},'output':{sector:6+era+(i%3)},
                'upkeep':({'energy':1+era//3} if sector not in ('energy','knowledge','trust') and era>=3 else {}),
                'requires':([prev['id']] if prev and prev['era']==era else []),'maxCopies':1,
                'visual':{'family':sector,'stage':era,'reveal':'foundation-to-silhouette','anchor':'district-center'},
                'provenance':{'kind':'game-design','historicalStatus':'unverified-concept','sourceIds':[]},
                'codex':f'{purpose}. {tradeoff}. This programme is an abstract gameplay representation; its numerical effects are fictional balance values.'})
    policies=[]
    for s in sectors:
        for kind,name,gain,upkeep,tradeoff in POLICY_STYLES:
            policies.append({'id':f'{s}-{kind}','name':f'{s.title()}: {name}','sector':s,'output':{s:gain},'upkeep':upkeep,'tradeoff':tradeoff,'exclusiveGroup':s,'slots':1})
    events=[]
    for s,rows in EVENTS.items():
        for i,(eid,title,body) in enumerate(rows):
            events.append({'id':eid,'title':title,'sector':s,'body':body,'minEra':i,'cooldown':6,'choices':[
                {'id':'repair','label':'Fund a coordinated response','cost':{'materials':6,'knowledge':2},'delta':{s:12},'consequence':'The affected service gains capacity immediately; the shared stock pays the cost.'},
                {'id':'coordinate','label':'Organize local cooperation','cost':{'trust':3},'delta':{s:7},'consequence':'Local coordination restores some capacity with a smaller material commitment.'},
                {'id':'observe','label':'Record the pressure and continue','cost':{},'delta':{s:-4},'consequence':'The service loses four reserve units. This never ends the run.'}],
                'provenance':'fictional-scenario'})
    biomes=[{'id':bid,'name':name,'multipliers':{boost:mult,weak:low},'pressure':pressure,'palette':palette,'provenance':'fictional-environment-profile'} for bid,name,boost,mult,weak,low,pressure,palette in BIOMES]
    chapters=[];objectives=[];hints=[];variants=[]
    for idx,(cid,title,era,focus,biome,brief,lesson) in enumerate(CHAPTERS):
        target=next(p for p in projects if p['sector']==focus and p['era']==era)
        goalids=[cid+'-programme',cid+'-reserve',cid+'-continuity']
        chapters.append({'id':cid,'order':idx+1,'title':title,'era':era,'focus':focus,'recommendedBiome':biome,'brief':brief,'lesson':lesson,'targetProjectId':target['id'],'objectiveIds':goalids,'previousChapterId':CHAPTERS[idx-1][0] if idx else None,
            'narration':{'intro':f'{title}. {brief}','success':f'The settlement has made a lasting change. {lesson}','warning':f'The {focus} system needs attention. Open the forecast to see why.'},'historicalClaim':False})
        objectives.extend([
            {'id':goalids[0],'chapterId':cid,'kind':'build','projectId':target['id'],'target':1,'text':f'Establish {target["name"]}.'},
            {'id':goalids[1],'chapterId':cid,'kind':'stock','resource':focus,'target':40,'text':f'Hold 40 {focus} reserve units.'},
            {'id':goalids[2],'chapterId':cid,'kind':'turn','target':12,'text':'Complete 12 planning seasons; warnings do not erase progress.'}])
        for b in biomes:
            variants.append({'id':f'{cid}--{b["id"]}','chapterId':cid,'biomeId':b['id'],'seed':f'lifelines-v1:{cid}:{b["id"]}','classification':'generated-replay-variant','maxTurns':24,'startingStock':{s:45 for s in sectors}})
    for p in projects:
        texts=[f'Look at the {p["sector"]} forecast and identify what is being consumed.',f'{p["name"]} supports {p["sector"]}. Check its costs and era before choosing it.',f'Build {p["name"]} for {p["cost"]["materials"]} materials and {p["cost"]["knowledge"]} knowledge'+(f'; first establish {", ".join(p["requires"])}.' if p['requires'] else '.')]
        for level,t in enumerate(texts,1): hints.append({'id':f'{p["id"]}-hint-{level}','projectId':p['id'],'level':level,'text':t,'classification':'generated-from-authored-project'})
    db={'schemaVersion':1,'contentVersion':'1.0.0','balanceStatus':'prototype','historicalStatus':'fictional-systems-simulation','eras':[{'id':eid,'index':i,'name':name,'narration':line,'dateRange':None} for i,(eid,name,line) in enumerate(ERAS)],'resources':resources,'biomes':biomes,'projects':projects,'policies':policies,'events':events,'chapters':chapters,'objectives':objectives,'hints':hints,'variants':variants,
        'rules':{'actionsPerTurn':2,'policySlots':3,'stockCap':160,'eventEvery':4,'baseOutput':{'food':10,'water':10,'materials':5,'energy':4,'knowledge':3,'health':3,'shelter':2,'logistics':2,'ecology':2,'trust':2,'culture':2,'resilience':2},'consumption':{'food':8,'water':8,'energy':1,'health':2,'shelter':1,'trust':1},'shortageMode':'warnings-only'}}
    db['manifest']={'counts':{k:len(db[k]) for k in ['eras','resources','biomes','projects','policies','events','chapters','objectives','hints','variants']},'authoredConceptRows':len(projects)+len(policies)+len(events)+len(chapters)+len(biomes)+len(ERAS)+len(resources),'generatedRows':len(objectives)+len(hints)+len(variants),'uniqueAuthoredChapters':len(chapters),'replayVariantCount':len(variants),'note':'Policies use four common mechanical templates. Objectives and hints derive from projects and chapters. Variants combine 24 authored chapters with 12 authored biome profiles. None is presented as an independently authored historical scenario.'}
    (ROOT/'data/civilization').mkdir(parents=True, exist_ok=True)
    (ROOT/'data/civilization/lifelines.v1.json').write_text(json.dumps(db,ensure_ascii=False,indent=2)+'\n')
    print(json.dumps(db['manifest'],indent=2))
if __name__=='__main__': build()
