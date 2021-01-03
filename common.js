
var metadata = null;
var metadata_ammunitions = null;
var metadata_equips = null;
var metadata_skills = null;
var army_details_library = {};

var labels = {
	hidden: { // These hide the trooper until they are revealed and deployed
		equips: [24], // HoloMask
		skills: [29, 35, 238, 249, 33], // Camouflage, Combat Jump, Hidden Deployment, Impersonation, Parachutist
	},
	nfb: { // These cannot be used at the same time
		equips: [183, 24, 104], // Albedo, Holomask, Holoprojector
		hacks: ["Cybermask", "White Noise"],
		skills: [249, 28], // Impersonation, Mimetism
	},
	private: { // The existance of these are hidden
		skills: [26, 207, 119], // Chain of Command, Counterintelligence, Lieutenant
	},
};

$.getJSON('https://api.corvusbelli.com/army/infinity/en/metadata', function(e) {
	console.log(e);
	
	metadata = e;
	
	metadata_ammunitions = {};
	for (var i in e.ammunitions) metadata_ammunitions[e.ammunitions[i].id] = e.ammunitions[i];
	
	metadata_equips = {};
	for (var i in e.equips) metadata_equips[e.equips[i].id] = e.equips[i];
	
	metadata_skills = {};
	for (var i in e.skills) metadata_skills[e.skills[i].id] = e.skills[i];
});


function interpret_code (code)
{
	var reader = {
		code: atob(code),
		read_pos: 0,
		read_int: function () {
			var ret = this.code.charCodeAt(this.read_pos++);
			if (ret >= 128) return (ret - 128)*256 + this.code.charCodeAt(this.read_pos++);
			return ret;
		},
		read_string: function () {
			var str_len = this.read_int();
			var ret = this.code.substr(this.read_pos, str_len);
			this.read_pos += str_len;
			return ret;
		}
	};
	
	var ret = {
		faction_id: reader.read_int(),
		faction_url: reader.read_string(),
		list_name: reader.read_string(),
		point_limit: reader.read_int(),
		groups: [],
	}
	var i = reader.read_int();
	
	while (i-- > 0)
	{
		var group = {
			position: reader.read_int(),
			troopers: [],
		};
		var j = reader.read_int();
		
		while (j-- > 0)
		{
			var trooper = {
				position: reader.read_int(),
				unit_id: reader.read_int(),
				profile_group_id: reader.read_int(),
				option_id: reader.read_int(),
				spec_ops: reader.read_int(),
			};
			
			if (trooper.spec_ops != 0) return "SPEC OPS IS NOT SUPPORTED";
			group.troopers.push(trooper);
		}
		
		ret.groups.push(group);
	}
	
	if (reader.read_pos != reader.code.length) return "SOMETHING WENT WRONG READING THE CODE - INVALID CODE?";
	
	return ret;
}

function load_army_code (code, on_success)
{
	var ret = interpret_code(code);
	if (typeof ret !== "object")
	{
		alert(ret);
		return;
	}
	if (typeof army_details_library[ret.faction_id] == 'undefined')
	{
		$.getJSON("https://api.corvusbelli.com/army/units/en/" + ret.faction_id, function(e) {
			var extras = {};
			for (var i in e.filters.extras) extras[e.filters.extras[i].id] = e.filters.extras[i];
			var chars = {};
			for (var i in e.filters.chars) chars[e.filters.chars[i].id] = e.filters.chars[i];
			var peripheral = {};
			for (var i in e.filters.peripheral) peripheral[e.filters.peripheral[i].id] = e.filters.peripheral[i];
			var type = {};
			for (var i in e.filters.type) type[e.filters.type[i].id] = e.filters.type[i];
			var weapons = {};
			for (var i in e.filters.weapons) weapons[e.filters.weapons[i].id] = e.filters.weapons[i];
			
			e.library = {
				extras: extras,
				chars: chars,
				peripheral: peripheral,
				type: type,
				weapons: weapons,
			};
			
			army_details_library[ret.faction_id] = e;
			on_success(army_details_library[ret.faction_id], ret);
		});
	}
	else
	{
		on_success(army_details_library[ret.faction_id], ret);
	}
}

function fetch_list_details (code, on_success)
{
	load_army_code(code, function (army, list)
	{
		var ret = [];
		
		for (var x in list.groups)
		{
			var ret_group = [];
			
			for (var y in list.groups[x].troopers)
			{
				ret_group.push( resolve_trooper_details(army, list.groups[x].troopers[y]) );
			}
			
			ret.push(ret_group);
		}
		
		on_success (army, list, ret);
	});
}

function resolve_trooper_details (army, trooper)
{
	var unit_profile = null;
	var profile_group = null;
	var option_profile = null;
	
	for (var i in army.units)
	{
		if (army.units[i].id == trooper.unit_id)
		{
			unit_profile = army.units[i];
			for (var j in unit_profile.profileGroups)
			{
				if (unit_profile.profileGroups[j].id == trooper.profile_group_id)
				{
					profile_group = unit_profile.profileGroups[j];
					for (var k in profile_group.options)
					{
						if (profile_group.options[k].id == trooper.option_id)
						{
							option_profile = profile_group.options[k];
							break;
						}
					}
					break;
				}
			}
			break;
		}
	}
	
	// -- Check for if the ids were correctly resolved into profiles
	
	if (unit_profile == null)
	{
		alert("THERE WAS A PROBLEM TRYING TO RESOLVE THE UNIT PROFILE FOR A TROOPER");
		console.log([trooper, army]);
		return;
	}
	if (profile_group == null)
	{
		alert("THERE WAS A PROBLEM TRYING TO RESOLVE THE PROFILE GROUP FOR A TROOPER");
		console.log([trooper, army, unit_profile]);
		return;
	}
	if (option_profile == null)
	{
		alert("THERE WAS A PROBLEM TRYING TO RESOLVE THE OPTION PROFILE FOR A TROOPER");
		console.log([trooper, army, unit_profile, option_profile]);
		return;
	}
	
	
	// -- Check for compatability against what this app is currently capable of
	
	if (profile_group.profiles.length != 1)
	{
		alert("CANNOT CURRENTLY PROCESS UNITS WITH MULTIPLE PROFILES - different profiles may have different skills, equips, attributes, weapons");
	}
	if (profile_group.profiles[0].includes.length != 0 || option_profile.includes.length != 0)
	{
		alert("CANNOT CURRENTLY PROCESS UNITS WITH INCLUDED PROFILES");
	}
	
	// TODO:
	// Secondary profile attributes
	// Secondary profile skills/equipment/weapons
	// Included profiles
	
	var attributes = {};
	
	// -- Process the main profile
	var p = profile_group.profiles[0];
	
	// Attributes
	var attributes = {
		name: p.name,
		move: p.move,
		cc: p.cc,
		bs: p.bs,
		ph: p.ph,
		wip: p.wip,
		arm: p.arm,
		bts: p.bts,
		w: p.w,
		str: p.str, // true or false to indicate what 'w' is
		s: p.s,
		type: army.library.type[p.type].name,
	};
	
	var abilities = [];
	
	var weapons = [];
	weapons = weapons.concat(profile_group.profiles[0].weapons);
	weapons = weapons.concat(option_profile.weapons);
	
	for (var i in weapons)
	{
		var w = weapons[i];
		if (w.hasOwnProperty("extra") && w.extra != null && w.extra.length > 1)
			alert("UNEXPECTED SKILL WITH MORE THAN 1 EXTRA");
		
		abilities.push({
			id: w.id,
			name: army.library.weapons[w.id].name,
			type: "WEAPON",
			extra: ( (w.hasOwnProperty("extra") && w.extra != null && w.extra.length == 1) ? army.library.extras[w.extra[0]] : null ),
			is_private: false,
		});
	}
	
	var skills = [];
	skills = skills.concat(profile_group.profiles[0].skills);
	skills = skills.concat(option_profile.skills);
	
	for (var i in skills)
	{
		var s = skills[i];
		if (s.hasOwnProperty("extra") && s.extra != null && s.extra.length > 1)
			alert("UNEXPECTED SKILL WITH MORE THAN 1 EXTRA");
		
		abilities.push({
			id: s.id,
			name: metadata_skills[s.id].name,
			type: "SKILL",
			extra: ( (s.hasOwnProperty("extra") && s.extra != null && s.extra.length == 1) ? army.library.extras[s.extra[0]] : null ),
			is_private: labels.private.skills.includes(s.id),
		});
	}
	
	var equips = [];
	equips = equips.concat(profile_group.profiles[0].equip);
	equips = equips.concat(option_profile.equip);
	
	for (var i in equips)
	{
		var e = equips[i];
		if (e.hasOwnProperty("extra") && e.extra != null && e.extra.length > 1)
			alert("UNEXPECTED SKILL WITH MORE THAN 1 EXTRA");
		
		abilities.push({
			id: e.id,
			name: metadata_equips[e.id].name,
			type: "EQUIPMENT",
			extra: ( (e.hasOwnProperty("extra") && e.extra != null && e.extra.length == 1) ? army.library.extras[e.extra[0]] : null ),
			is_private: false,
		});
	}
	
	return {
		name: option_profile.name,
		attributes: attributes,
		abilities: abilities,
		raw: {unit_profile:unit_profile, profile_group:profile_group, option_profile:option_profile},
		
		get_all_skills: function (include_private = false)
		{
			var ret = [];
			for (var i in this.abilities)
			{
				if (this.abilities[i].is_private && include_private == false) continue;
				if (this.abilities[i].type != "SKILL") continue;
				ret.push(this.abilities[i]);
			}
			return ret;
		},
		
		get_all_equipment: function (include_private = false)
		{
			var ret = [];
			for (var i in this.abilities)
			{
				if (this.abilities[i].is_private && include_private == false) continue;
				if (this.abilities[i].type != "EQUIPMENT") continue;
				ret.push(this.abilities[i]);
			}
			return ret;
		},
		
		get_all_weapons: function (include_private = false)
		{
			var ret = [];
			for (var i in this.abilities)
			{
				if (this.abilities[i].is_private && include_private == false) continue;
				if (this.abilities[i].type != "WEAPON") continue;
				ret.push(this.abilities[i]);
			}
			return ret;
		},
		
		has_hidden_ability: function()
		{
			for (var i in this.abilities)
			{
				var a = this.abilities[i];
				if (a.type == "SKILL" && labels.hidden.skills.includes(a.id))
					return true;
				if (a.type == "EQUIPMENT" && labels.hidden.equips.includes(a.id))
					return true;
			}
			return false;
		},
	};
}
