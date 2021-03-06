# frozen_string_literal: true

# rubocop:disable Style/ClassAndModuleChildren

require "tjson"

class Miscreant::Internals::AES::CMAC::Example
  attr_reader :key, :message, :tag

  # Error parsing the example file
  ParseError = Class.new(StandardError)

  # Default file to load examples from
  DEFAULT_EXAMPLES = File.expand_path("../../../../vectors/aes_cmac.tjson", __FILE__)

  def self.load_file(filename = DEFAULT_EXAMPLES)
    examples = TJSON.load_file(filename).fetch("examples")
    raise ParseError, "expected a toplevel array of examples" unless examples.is_a?(Array)

    examples.map { |example| new(example) }
  end

  def initialize(attrs)
    @key = attrs.fetch("key")
    @message = attrs.fetch("message")
    @tag = attrs.fetch("tag")
  end
end

class Miscreant::Internals::AES::SIV::Example
  attr_reader :name, :key, :ad, :plaintext, :ciphertext

  # Error parsing the example file
  ParseError = Class.new(StandardError)

  # Default file to load examples from
  DEFAULT_EXAMPLES = File.expand_path("../../../../vectors/aes_siv.tjson", __FILE__)

  def self.load_file(filename = DEFAULT_EXAMPLES)
    examples = TJSON.load_file(filename).fetch("examples")
    raise ParseError, "expected a toplevel array of examples" unless examples.is_a?(Array)

    examples.map { |example| new(example) }
  end

  def initialize(attrs)
    @name = attrs.fetch("name")
    @key = attrs.fetch("key")
    @ad = attrs.fetch("ad")
    @plaintext = attrs.fetch("plaintext")
    @ciphertext = attrs.fetch("ciphertext")
  end
end

class Miscreant::Internals::Util::DblExample
  attr_reader :input, :output

  # Error parsing the example file
  ParseError = Class.new(StandardError)

  # Default file to load examples from
  DEFAULT_EXAMPLES = File.expand_path("../../../../vectors/dbl.tjson", __FILE__)

  def self.load_file(filename = DEFAULT_EXAMPLES)
    examples = TJSON.load_file(filename).fetch("examples")
    raise ParseError, "expected a toplevel array of examples" unless examples.is_a?(Array)

    examples.map { |example| new(example) }
  end

  def initialize(attrs)
    @input = attrs.fetch("input")
    @output = attrs.fetch("output")
  end
end
