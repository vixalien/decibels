desktop_conf = configuration_data()
desktop_conf.set('app-id', application_id)

desktop_file = i18n.merge_file(
  input: configure_file(
    input: 'com.vixalien.decibels.desktop.in.in',
    output: '@BASENAME@',
    configuration: desktop_conf
  ),
  output: '@0@.desktop'.format(application_id),
  type: 'desktop',
  po_dir: '../po',
  install: true,
  install_dir: decibels_datadir / 'applications'
)

desktop_utils = find_program('desktop-file-validate', required: false)
if desktop_utils.found()
  test('Validate desktop file', desktop_utils, args: [desktop_file])
endif

appstream_conf = configuration_data()
appstream_conf.set('app-id', application_id)
appstream_conf.set('gettext-package', gettext_package)

appstream_file = i18n.merge_file(
  input: configure_file(
  	input: 'com.vixalien.decibels.metainfo.xml.in.in',
  	output: '@BASENAME@',
  	configuration: appstream_conf
	),
  output: 'com.vixalien.decibels.metainfo.xml',
  po_dir: '../po',
  install: true,
  install_dir: decibels_datadir / 'metainfo'
)

# Validate Appdata
appstreamcli = find_program('appstreamcli', required: false)
if (appstreamcli.found())
  test('Validate appdata file',
    appstreamcli,
    args: ['validate', '--no-net', '--explain', appstream_file],
    workdir: meson.current_build_dir()
  )
endif

gsettings_conf = configuration_data()
gsettings_conf.set('app-id', application_id)
gsettings_conf.set('gettext-package', gettext_package)
gsettings_schema = configure_file(
  input: 'com.vixalien.decibels.gschema.xml.in',
  output: '@0@.gschema.xml'.format(application_id),
  configuration: gsettings_conf,
  install: true,
  install_dir: decibels_schemadir
)

compile_schemas = find_program('glib-compile-schemas', required: false)

compile_local_schemas = custom_target(
  'compile_local_schemas',
  input: gsettings_schema,
  output: 'gschemas.compiled',
  command: [compile_schemas, meson.current_build_dir()]
)

if compile_schemas.found()
  test('Validate schema file',
       compile_schemas,
       args: ['--strict', '--dry-run', meson.current_source_dir()])
endif

data_res = gnome.compile_resources(
  application_id + '.data',
  'com.vixalien.decibels.data.gresource.xml',
  gresource_bundle: true,
  install: true,
  install_dir: decibels_pkgdatadir,
  dependencies: appstream_file,
)

service_conf = configuration_data()
service_conf.set('application_id', application_id)
service_conf.set('bindir', decibels_bindir)
configure_file(
  input: 'com.vixalien.decibels.service.in',
  output: '@0@.service'.format(application_id),
  configuration: service_conf,
  install: true,
  install_dir: decibels_datadir / 'dbus-1/services',
)

subdir('icons')
