
var metdata = null;
var army_details_library = {};

var labels = {
	nfb: {skills: [], equips: []}
};

$.getJSON('https://api.corvusbelli.com/army/infinity/en/metadata', function(e) {
	console.log(e);
	
	metadata = {
		ammunitions: {},
		equips: {},
		skills: {},
		weapons: {}
	};
	for (var i in e.ammunitions) metadata.ammunitions[e.ammunitions[i].id] = e.ammunitions[i];
	for (var i in e.equips) metadata.equips[e.equips[i].id] = e.equips[i];
	for (var i in e.skills) metadata.skills[e.skills[i].id] = e.skills[i];
	for (var i in e.weapons) metadata.weapons[e.weapons[i].id] = e.weapons[i];
	
	console.log(metadata);
	
	// Locate NFB skills
	if (metadata.skills[249].name == "Impersonation") labels.nfb.skills.push(249);
	else alert("Could not locate Impersonation skill");
	if (metadata.skills[28].name == "Mimetism") labels.nfb.skills.push(28);
	else alert("Could not locate Mimetism skill");
	// Locate NFB equips
	if (metadata.equips[183].name == "Albedo") labels.nfb.equips.push(183);
	else alert("Could not locate Albedo equip");
	if (metadata.equips[24].name == "Holomask") labels.nfb.equips.push(24);
	else alert("Could not locate Holomask equip");
	if (metadata.equips[104].name == "Holoprojector") labels.nfb.equips.push(104);
	else alert("Could not locate Holoprojector equip");
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
		$.getJSON("https://api.corvusbelli.com/army/units/en/" + ret.faction_id, function(e) { army_details_library[ret.faction_id] = e; on_success(army_details_library[ret.faction_id], ret); });
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
				var current_trooper = list.groups[x].troopers[y];
				var unit_profile = null;
				var profile_group = null;
				var option_profile = null;
				
				for (var i in army.units)
				{
					if (army.units[i].id == current_trooper.unit_id)
					{
						unit_profile = army.units[i];
						for (var j in unit_profile.profileGroups)
						{
							if (unit_profile.profileGroups[j].id == current_trooper.profile_group_id)
							{
								profile_group = unit_profile.profileGroups[j];
								for (var k in profile_group.options)
								{
									if (profile_group.options[k].id == current_trooper.option_id)
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
				
				if (unit_profile == null)
				{
					alert("THERE WAS A PROBLEM TRYING TO RESOLVE THE UNIT PROFILE FOR A TROOPER");
					console.log([current_trooper, army]);
					return;
				}
				if (profile_group == null)
				{
					alert("THERE WAS A PROBLEM TRYING TO RESOLVE THE PROFILE GROUP FOR A TROOPER");
					console.log([current_trooper, army, unit_profile]);
					return;
				}
				if (option_profile == null)
				{
					alert("THERE WAS A PROBLEM TRYING TO RESOLVE THE OPTION PROFILE FOR A TROOPER");
					console.log([current_trooper, army, unit_profile, option_profile]);
					return;
				}
				
				
				
				ret_group.push({
					name: option_profile.name,
					raw: {unit_profile:unit_profile, profile_group:profile_group, option_profile:option_profile}
				});
			}
			ret.push(ret_group);
		}
		
		on_success (army, list, ret);
	});
}
